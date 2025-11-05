'use client';

// This component is responsible for everything related to the chat input area.
// We moved it out of the main chat.tsx file to keep the code organized and easier to understand.
// It handles typing, sending messages, attachments, voice notes, emojis, mentions, and text formatting.

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MoreVertical, Paperclip, Phone, Send, Smile, Video, Mic, Check, CheckCheck, Pencil, Trash2, SmilePlus, X, FileIcon, Download, StopCircle, Copy, Star, Share2, Shield, Loader2, Pause, Play, StickyNote, Users, UserX, ShieldAlert, Pin, PinOff, Reply, Clock, CircleSlash, ArrowDown, AtSign, Image as ImageIcon, Info, Bold, Italic, Strikethrough, Code, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TextareaAutosize from 'react-textarea-autosize';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Chat, Message, AttachmentMetadata } from '@/lib/';
import type { User } from '@/lib/auth';
import { cn, createClient } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import EmojiPicker, { EmojiClickData, SkinTones } from 'emoji-picker-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from 'next/image';
import { useAppContext } from '@/providers/app-provider';

// This is a constant string used in our Supabase database queries.
// It tells the database exactly which columns we want to fetch for a message,
// including related data like the sender's profile and the message being replied to.
const FULL_MESSAGE_SELECT_QUERY = `
    *, 
    read_by,
    profiles!user_id(*), 
    replied_to_message:reply_to_message_id(*, profiles!user_id(*))
`;

// A helper function to format seconds into a "minutes:seconds" string for the voice recorder.
const formatRecordingTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

// --- UPDATED PROPS ---
// We've removed the old props that are no longer needed,
// as this component will now get its logic from the AppContext.
interface ChatInputProps {
    chat: Chat;
    loggedInUser: User;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    replyingTo: Message | null;
    setReplyingTo: React.Dispatch<React.SetStateAction<Message | null>>;
    editingMessage: { id: number; content: string } | null;
    setEditingMessage: React.Dispatch<React.SetStateAction<{ id: number; content: string } | null>>;
    onSaveEdit: () => void;
    messagesEndRef: React.RefObject<HTMLDivElement>;
    isChannel: boolean;
    canPostInChannel: boolean | undefined;
    
    // REMOVED: isChatPartnerBlocked
    // REMOVED: isDmRestricted
    // REMOVED: existingRequest
    // REMOVED: onUnblockUser
    // REMOVED: onRequestDm
}
// --- END UPDATED PROPS ---

export function ChatInput({
    chat,
    loggedInUser,
    setMessages,
    replyingTo,
    setReplyingTo,
    editingMessage,
    setEditingMessage,
    onSaveEdit,
    messagesEndRef,
    isChannel,
    canPostInChannel,
    // Old props are removed from here
}: ChatInputProps) {
    const { toast } = useToast();
    
    // --- UPDATED: Get new state from AppContext ---
    const { allUsers, relationships, unblockUser, followUser } = useAppContext();
    // --- END UPDATE ---
    
    const [message, setMessage] = useState('');
    const [caption, setCaption] = useState('');
    const [attachmentPreview, setAttachmentPreview] = useState<{ file: File, url: string } | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const attachmentInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    const [isRecording, setIsRecording] = useState(false);
    const [recordingStatus, setRecordingStatus] = useState<'recording' | 'paused'>('recording');
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [isEmojiOpen, setIsEmojiOpen] = useState(false);
    
    const [stickerList, setStickerList] = useState<string[]>([]);
    const [customEmojiList, setCustomEmojiList] = useState<string[]>([]);

    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [activeMentionIndex, setActiveMentionIndex] = useState(0);
    
    const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
    const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number } | null>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);

    const supabase = createClient();
    const isGroup = chat.type === 'group' || chat.type === 'channel';

    // --- NEW: Logic for checking relationships ---
    const chatPartner = useMemo(() => {
        if (isGroup || !chat.participants) return null;
        const partnerRecord = chat.participants.find(p => p.user_id !== loggedInUser.id);
        return partnerRecord?.profiles ?? null;
    }, [chat, loggedInUser.id, isGroup]);

    const myRelationship = useMemo(() => {
        if (isGroup || !relationships || !loggedInUser || !chatPartner) return null;
        return relationships.find(r => r.user_one_id === loggedInUser.id && r.user_two_id === chatPartner.id);
    }, [relationships, loggedInUser, chatPartner, isGroup]);

    const theirRelationship = useMemo(() => {
        if (isGroup || !relationships || !loggedInUser || !chatPartner) return null;
        return relationships.find(r => r.user_one_id === chatPartner.id && r.user_two_id === loggedInUser.id);
    }, [relationships, loggedInUser, chatPartner, isGroup]);

    const iAmBlocked = theirRelationship?.status === 'blocked';
    const isBlockedByMe = myRelationship?.status === 'blocked';
    const isMutualFollow = (myRelationship?.status === 'approved' && theirRelationship?.status === 'approved');

    // This is the single source of truth for whether the input is disabled
    const canSendMessage = isGroup || (!isBlockedByMe && !iAmBlocked && isMutualFollow);
    
    // --- END NEW LOGIC ---

    useEffect(() => {
        if (editingMessage) {
            setMessage(editingMessage.content);
            textareaRef.current?.focus();
        } else {
            setMessage('');
        }
    }, [editingMessage]);

    useEffect(() => {
        if (replyingTo) {
            textareaRef.current?.focus();
        }
    }, [replyingTo]);
    
    useEffect(() => {
        fetch('/api/assets')
            .then(res => res.json())
            .then(data => {
                setStickerList(data.stickers || []);
                setCustomEmojiList(data.emojis || []);
            });
    }, []);

    const processAudio = async (audioBlob: Blob): Promise<{ duration: number; waveform: number[] }> => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const duration = audioBuffer.duration;
        
        const rawData = audioBuffer.getChannelData(0);
        const samples = 64; // Number of waveform bars
        const blockSize = Math.floor(rawData.length / samples);
        const waveform = [];
        for (let i = 0; i < samples; i++) {
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(rawData[i * blockSize + j]);
            }
            waveform.push(sum / blockSize);
        }

        // Normalize waveform data
        const max = Math.max(...waveform);
        const normalizedWaveform = waveform.map(v => Math.max(0.05, v / max));

        return { duration, waveform: normalizedWaveform };
    };

    const handleSendMessage = async ({ content, contentToSave, attachment }: { content: string, contentToSave?: string, attachment?: { file: File, url: string, waveform?: number[], duration?: number }}) => {
        // --- UPDATED: Check permissions before sending ---
        if (!canSendMessage) {
            toast({ variant: 'destructive', title: "Cannot send message", description: "You cannot send messages in this chat." });
            return;
        }
        // --- END UPDATE ---
        
        if (isSending || (content.trim() === '' && !attachment)) return;
        
        setIsSending(true);
        const tempId = `temp-${uuidv4()}`;
        
        const attachmentMetadata = attachment 
            ? { 
                name: attachment.file.name, 
                type: attachment.file.type, 
                size: attachment.file.size,
                waveform: attachment.waveform,
                duration: attachment.duration,
            } 
            : null;

        const optimisticMessage: Message = {
          id: tempId,
          created_at: new Date().toISOString(),
          chat_id: chat.id,
          user_id: loggedInUser.id,
          content: content.trim(),
          attachment_url: attachment ? attachment.url : null,
          attachment_metadata: attachmentMetadata,
          reply_to_message_id: replyingTo && typeof replyingTo.id === 'number' ? replyingTo.id : undefined,
          profiles: loggedInUser,
          replied_to_message: replyingTo,
          is_edited: false,
          reactions: null,
          read_by: [loggedInUser.id]
        };
        
        setMessages(current => [...current, optimisticMessage]);
        setMessage('');
        setCaption('');
        setReplyingTo(null);
        setAttachmentPreview(null);
        setIsPreviewOpen(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

        try {
            let attachmentUrl: string | null = null;
            if (attachment) {
                const file = attachment.file;
                const fileExt = file.name.split('.').pop();
                const filePath = `${uuidv4()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('attachments')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('attachments')
                    .getPublicUrl(filePath);
                
                attachmentUrl = urlData.publicUrl;
            }
            
            let finalContent = contentToSave ?? content;
            const { data: insertedMessage, error } = await supabase
                .from('messages')
                .insert({
                    chat_id: chat.id,
                    user_id: loggedInUser.id,
                    content: finalContent.trim(),
                    attachment_url: attachmentUrl,
                    attachment_metadata: attachmentMetadata,
                    reply_to_message_id: replyingTo && typeof replyingTo.id === 'number' ? replyingTo.id : undefined,
                })
                .select(FULL_MESSAGE_SELECT_QUERY)
                .single();

            if (error) throw error;
            
            if (insertedMessage) {
              setMessages(current => current.map(m => (m.id === tempId ? (insertedMessage as Message) : m)));
            } else {
              setMessages(current => current.filter(m => m.id !== tempId));
            }

        } catch (error: any) {
             toast({ variant: 'destructive', title: "Error sending message", description: error.message });
             setMessages(current => current.filter(m => m.id !== tempId));
        } finally {
            setIsSending(false);
        }
    };
    
    const handleSendSticker = async (stickerUrl: string) => {
        // --- UPDATED: Check permissions before sending ---
        if (!canSendMessage) {
            toast({ variant: 'destructive', title: "Cannot send message", description: "You cannot send messages in this chat." });
            return;
        }
        // --- END UPDATE ---
        
        if (isSending) return;
        
        setIsSending(true);
        const tempId = `temp-${uuidv4()}`;
        const isSticker = stickerUrl.includes('/stickers/');
        const attachmentMetadata: AttachmentMetadata = { 
            name: isSticker ? 'sticker.webp' : 'emoji.png', 
            type: isSticker ? 'image/webp' : 'image/png', 
            size: 0 
        };

        const optimisticMessage: Message = {
            id: tempId,
            created_at: new Date().toISOString(),
            chat_id: chat.id,
            user_id: loggedInUser.id,
            content: null,
            attachment_url: stickerUrl,
            attachment_metadata: attachmentMetadata,
            reply_to_message_id: replyingTo && typeof replyingTo.id === 'number' ? replyingTo.id : undefined,
            profiles: loggedInUser,
            replied_to_message: replyingTo,
            is_edited: false,
            reactions: null,
            read_by: [loggedInUser.id]
        };

        setMessages(current => [...current, optimisticMessage]);
        setReplyingTo(null);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        
        try {
            const { data: insertedMessage, error } = await supabase
                .from('messages')
                .insert({
                    chat_id: chat.id,
                    user_id: loggedInUser.id,
                    content: null,
                    attachment_url: stickerUrl,
                    attachment_metadata: attachmentMetadata,
                    reply_to_message_id: replyingTo && typeof replyingTo.id === 'number' ? replyingTo.id : undefined,
                })
                .select(FULL_MESSAGE_SELECT_QUERY)
                .single();
    
            if (error) throw error;
            
            if (insertedMessage) {
              setMessages(current => current.map(m => (m.id === tempId ? (insertedMessage as Message) : m)));
            }

        } catch (error: any) {
             toast({ variant: 'destructive', title: "Error sending sticker", description: error.message });
             setMessages(current => current.filter(m => m.id !== tempId));
        } finally {
            setIsSending(false);
        }
    };
    
    // Most of the file below here is just the UI and logic for
    // emoji, attachments, voice notes, and text formatting.
    // It does not need to change.
    
    const handleEmojiClick = (emojiData: EmojiClickData) => {
        setMessage(prevMessage => prevMessage + emojiData.emoji);
    };

    const handleCustomEmojiMessage = (emojiUrl: string) => {
        const isSticker = stickerList.includes(emojiUrl);
        if (isSticker) {
            handleSendSticker(emojiUrl);
            setIsEmojiOpen(false);
            return;
        }

        const emojiName = emojiUrl.split('/').pop()?.split('.')[0] || 'custom_emoji';
        setMessage(prev => prev + `:${emojiName}:`);
        setIsEmojiOpen(false);
    };

    const handleAttachmentClick = () => attachmentInputRef.current?.click();

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const fileUrl = e.target?.result as string;
                setAttachmentPreview({ file, url: fileUrl });
                setIsPreviewOpen(true);
            };
            reader.readAsDataURL(file);
        }
        if (event.target) event.target.value = '';
    };

    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
                const optimisticUrl = URL.createObjectURL(audioBlob);

                try {
                    const { duration, waveform } = await processAudio(audioBlob);
                    
                    await handleSendMessage({ 
                        content: '', 
                        attachment: { 
                            file: audioFile, 
                            url: optimisticUrl,
                            duration,
                            waveform,
                        } 
                    });
                } catch (err) {
                    console.error("Failed to process audio:", err);
                    toast({ variant: 'destructive', title: 'Could not process voice note.', description: 'Please try again.' });
                }
                
                stream.getTracks().forEach(track => track.stop());
                if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
                setIsRecording(false);
                setRecordingTime(0);
            };
            
            mediaRecorderRef.current.onpause = () => {
                 if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
            };

            mediaRecorderRef.current.onresume = () => {
                recordingIntervalRef.current = setInterval(() => {
                    setRecordingTime(prev => prev + 1);
                }, 1000);
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingStatus('recording');
            setRecordingTime(0);
            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (error) {
            toast({ variant: 'destructive', title: "Microphone access denied", description: "Please allow microphone access in your browser settings." });
        }
    };

    const handleStopAndSendRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
        }
    };
    
    const handleTogglePauseResume = () => {
        if (!mediaRecorderRef.current) return;

        if (recordingStatus === 'paused') {
            mediaRecorderRef.current.resume();
            setRecordingStatus('recording');
        } else {
            mediaRecorderRef.current.pause();
            setRecordingStatus('paused');
        }
    };

    const handleCancelRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            mediaRecorderRef.current.onstop = null; // Prevent sending
            mediaRecorderRef.current.stop();
            if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
            setIsRecording(false);
            setRecordingTime(0);
        }
    };

    const mentionableUsers = useMemo(() => {
        if (mentionQuery === null || !isGroup || !chat.participants) return [];
        
        const all = [
            { id: 'everyone', username: 'everyone', name: 'Notify everyone in this group', avatar_url: '' },
            ...chat.participants.map(p => p.profiles).filter((p): p is User => !!p)
        ];

        return all.filter(u => {
            const query = mentionQuery.toLowerCase();
            const usernameMatch = (u.username || '').toLowerCase().includes(query);
            const nameMatch = (u.name || '').toLowerCase().includes(query);
            return usernameMatch || nameMatch;
        });
    }, [mentionQuery, chat.participants, isGroup]);

    const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        if (editingMessage) {
            setEditingMessage({ ...editingMessage, content: value });
        } else {
            setMessage(value);
        }

        if (!isGroup) return;

        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPosition);
        const mentionMatch = textBeforeCursor.match(/@([\w\d_]*)$/);
        
        if (mentionMatch) {
            setMentionQuery(mentionMatch[1].toLowerCase());
        } else {
            setMentionQuery(null);
        }
    };
    
    const getCaretCoordinates = (element: HTMLTextAreaElement, position: number) => {
        const isBrowser = typeof window !== 'undefined'
        if (!isBrowser) {
          throw new Error('getCaretCoordinates should only be called in a browser environment.')
        }

        const div = document.createElement('div')
        document.body.appendChild(div)
      
        const style = div.style
        const computed = window.getComputedStyle(element)
      
        style.whiteSpace = 'pre-wrap'
        style.wordWrap = 'break-word'
        style.position = 'absolute'
        style.visibility = 'hidden'
      
        const properties = [
          'direction', 'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
          'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
          'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
          'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust',
          'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent', 'textDecoration',
          'letterSpacing', 'wordSpacing', 'tabSize',
        ]
      
        properties.forEach(prop => {
          style[prop as any] = computed[prop as any]
        })
      
        div.textContent = element.value.substring(0, position)
      
        const span = document.createElement('span')
        span.textContent = element.value.substring(position) || '.'
        div.appendChild(span)
      
        const coordinates = {
          top: span.offsetTop + parseInt(computed.borderTopWidth),
          left: span.offsetLeft + parseInt(computed.borderLeftWidth),
          height: parseInt(computed.lineHeight),
        }
      
        div.remove()
      
        return coordinates
      }
    
    const handleTextSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
  
      if (start === end || !textareaRef.current) {
        setSelection(null);
        setToolbarPosition(null);
        return;
      }
  
      setSelection({ start, end });
  
      const rect = textarea.getBoundingClientRect();
      const caretPos = getCaretCoordinates(textarea, start);
      
      const toolbarHeight = toolbarRef.current?.offsetHeight || 40;

      setToolbarPosition({
        top: rect.top + window.scrollY + caretPos.top - toolbarHeight - 5,
        left: rect.left + window.scrollX + caretPos.left,
      });
    };

    const applyFormatting = (format: 'bold' | 'italic' | 'strikethrough' | 'code') => {
        if (!selection || !textareaRef.current) return;

        const { start, end } = selection;
        const currentMessage = editingMessage ? editingMessage.content : message;
        const selectedText = currentMessage.substring(start, end);
        let prefix, suffix;

        switch (format) {
            case 'bold': prefix = '**'; suffix = '**'; break;
            case 'italic': prefix = '_'; suffix = '_'; break;
            case 'strikethrough': prefix = '~~'; suffix = '~~'; break;
            case 'code': prefix = '`'; suffix = '`'; break;
        }

        const newText = 
            currentMessage.substring(0, start) +
            prefix + selectedText + suffix +
            currentMessage.substring(end);

        if (editingMessage) {
            setEditingMessage({ ...editingMessage, content: newText });
        } else {
            setMessage(newText);
        }
        
        const newCursorPos = start + prefix.length + selectedText.length + suffix.length;
        setTimeout(() => {
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
            setSelection(null);
            setToolbarPosition(null);
        }, 10);
    };

    const handleMentionSelect = (username: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const cursorPosition = textarea.selectionStart;
        const currentMessage = editingMessage ? editingMessage.content : message;
        const textBeforeCursor = currentMessage.substring(0, cursorPosition);
        
        const mentionMatch = textBeforeCursor.match(/@([\w\d_]*)$/);
        if (!mentionMatch) return;

        const startIndex = mentionMatch.index || 0;
        const newText = 
            currentMessage.substring(0, startIndex) +
            `@${username} ` +
            currentMessage.substring(cursorPosition);
        
        if (editingMessage) {
            setEditingMessage({ ...editingMessage, content: newText });
        } else {
            setMessage(newText);
        }
        setMentionQuery(null);
        
        setTimeout(() => {
            textarea.focus();
            const newCursorPosition = startIndex + username.length + 2;
            textarea.selectionStart = textarea.selectionEnd = newCursorPosition;
        }, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (mentionQuery !== null && mentionableUsers.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveMentionIndex(prev => (prev + 1) % mentionableUsers.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveMentionIndex(prev => (prev - 1 + mentionableUsers.length) % mentionableUsers.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                handleMentionSelect(mentionableUsers[activeMentionIndex].username);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setMentionQuery(null);
            }
        } else if (e.key === 'Enter' && e.shiftKey) {
             // Let default behavior (new line) happen
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (editingMessage) {
                if(editingMessage.content.trim()) onSaveEdit();
            } else {
                if(message.trim()) handleSendMessage({ content: message });
            }
        }
    };

    const currentMessageValue = editingMessage ? editingMessage.content : message;

    // --- UPDATED: Restriction Banners ---
    // This section is now driven by the new relationship logic
    
    if (isChannel && !canPostInChannel) {
        return (
            <div className="p-2 border-t bg-background shrink-0">
                <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertTitle>Channel is read-only</AlertTitle>
                    <AlertDescription>Only admins can send messages in this channel.</AlertDescription>
                </Alert>
            </div>
        );
    }
    
    // You blocked this user
    if (isBlockedByMe) {
        return (
            <div className="p-2 border-t bg-background shrink-0">
                <Alert variant="destructive">
                    <UserX className="h-4 w-4" />
                    <AlertTitle>User Blocked</AlertTitle>
                    <AlertDescription className="flex items-center justify-between gap-4">
                        <span>You can't send messages to a user you have blocked.</span>
                        <Button variant="outline" size="sm" onClick={() => chatPartner && unblockUser(chatPartner.id)}>Unblock</Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    // This user blocked you
    if (iAmBlocked) {
        return (
            <div className="p-2 border-t bg-background shrink-0">
                <Alert variant="destructive">
                    <UserX className="h-4 w-4" />
                    <AlertTitle>You are Blocked</AlertTitle>
                    <AlertDescription>
                        You cannot send messages to this user.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    // Neither of you are blocked, but you don't have mutual follows
    if (!isGroup && !canSendMessage) {
        return (
            <div className="p-2 border-t bg-background shrink-0">
                <Alert>
                    <UserPlus className="h-4 w-4" />
                    <AlertTitle>Follow to Message</AlertTitle>
                    <AlertDescription className="flex items-center justify-between gap-4">
                        <span>You can only message users that you mutually follow.</span>
                        <Button onClick={() => chatPartner && followUser(chatPartner.id)}>
                            {myRelationship?.status === 'pending' ? 'Request Sent' : 'Follow'}
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }
    // --- END OF UPDATED BANNERS ---

    if (isRecording) {
        return (
            <div className="p-2 border-t bg-background shrink-0">
                 <div className="flex items-center w-full gap-2 bg-muted p-2 rounded-lg">
                    <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={handleCancelRecording}>
                        <Trash2 className="h-5 w-5" />
                        <span className="sr-only">Cancel recording</span>
                    </Button>

                    <div className="flex-1 flex items-center justify-between gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleTogglePauseResume}>
                            {recordingStatus === 'paused' ? <Play className="fill-current" /> : <Pause />}
                            <span className="sr-only">{recordingStatus === 'paused' ? 'Resume' : 'Pause'} recording</span>
                        </Button>
                        <div className="flex items-center gap-2">
                             <div className="w-2.5 h-2.5 bg-destructive rounded-full animate-pulse"></div>
                             <span className="text-sm font-mono text-muted-foreground">{formatRecordingTime(recordingTime)}</span>
                        </div>
                    </div>
                   
                    <Button size="icon" className="h-10 w-10 bg-green-500 hover:bg-green-600" onClick={handleStopAndSendRecording}>
                        <Send />
                        <span className="sr-only">Send recording</span>
                    </Button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="p-2 border-t bg-background shrink-0">
            <input type="file" ref={attachmentInputRef} onChange={handleFileSelect} className="hidden" />
             <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader><DialogTitle>Send Attachment</DialogTitle></DialogHeader>
                    <div className="flex flex-col gap-4 py-4">
                        {/* Preview content... */}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={() => attachmentPreview && handleSendMessage({ content: caption, attachment: { file: attachmentPreview.file, url: attachmentPreview.url } })} disabled={isSending}>
                            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Send
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {replyingTo && (
                <div className="flex items-center justify-between p-2 pl-3 mb-2 rounded-t-md bg-muted text-sm border-b">
                    <div>
                        <p className="font-semibold text-primary">Replying to {replyingTo.profiles.name}</p>
                        <p className="text-muted-foreground truncate max-w-xs">{replyingTo.content || (replyingTo.attachment_metadata?.name || 'Attachment')}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setReplyingTo(null)} className="h-7 w-7"><X className="h-4 w-4"/></Button>
                </div>
            )}
             {editingMessage && (
                <div className="flex items-center justify-between p-2 pl-3 mb-2 rounded-t-md bg-muted text-sm border-b">
                    <p className="font-semibold text-primary">Editing message...</p>
                    <Button variant="ghost" size="icon" onClick={() => setEditingMessage(null)} className="h-7 w-7"><X className="h-4 w-4"/></Button>
                </div>
            )}
            <div className="relative">
               {toolbarPosition && selection && (
                    <div
                        ref={toolbarRef}
                        className="fixed z-10 bg-background border rounded-md shadow-lg p-1 flex gap-1"
                        style={{ top: toolbarPosition.top, left: toolbarPosition.left, transform: 'translateX(-50%)' }}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyFormatting('bold')}><Bold className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyFormatting('italic')}><Italic className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyFormatting('strikethrough')}><Strikethrough className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyFormatting('code')}><Code className="h-4 w-4" /></Button>
                    </div>
                )}
               {mentionQuery !== null && (
                    <Card className="absolute bottom-full left-0 mb-2 w-72 shadow-lg z-50">
                        <ScrollArea className="max-h-48">
                            <CardContent className="p-1">
                                {mentionableUsers.length > 0 ? (
                                    mentionableUsers.map((user, index) => (
                                        <button
                                            key={user.id}
                                            onClick={() => handleMentionSelect(user.username)}
                                            className={cn("flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-accent", activeMentionIndex === index && "bg-accent")}
                                        >
                                            {user.id === 'everyone' ? (
                                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"><Users className="h-4 w-4"/></div>
                                            ) : (
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={(user as User).avatar_url} alt={user.name} />
                                                    <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                            )}
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="font-semibold truncate">{user.username}</span>
                                                <span className="text-xs text-muted-foreground truncate">{user.name}</span>
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-2 text-center text-sm text-muted-foreground">No users found</div>
                                )}
                            </CardContent>
                        </ScrollArea>
                    </Card>
                )}
              <TextareaAutosize
                ref={textareaRef}
                placeholder={isGroup ? "Type @ to mention users..." : "Type a message..."}
                className={cn("pr-36 min-h-[40px] max-h-40 resize-none w-full border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-md", (replyingTo || editingMessage) && "rounded-t-none")}
                minRows={1}
                maxRows={5}
                value={currentMessageValue}
                onChange={handleMessageChange}
                onKeyDown={handleKeyDown}
                onSelect={handleTextSelection}
                onBlur={() => { setTimeout(() => { if (!toolbarRef.current?.contains(document.activeElement)) { setSelection(null); setToolbarPosition(null); } }, 150); }}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                <Popover open={isEmojiOpen} onOpenChange={setIsEmojiOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon"><Smile className="h-5 w-5"/></Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full max-w-sm sm:max-w-sm p-0 border-none mb-2" side="top" align="end">
                        <Tabs defaultValue="emoji" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="custom-emoji"><ImageIcon className="mr-2 h-4 w-4" />Official</TabsTrigger>
                                <TabsTrigger value="emoji"><Smile className="mr-2 h-4 w-4" />Emojis</TabsTrigger>
                                <TabsTrigger value="stickers"><StickyNote className="mr-2 h-4 w-4" />Stickers</TabsTrigger>
                            </TabsList>
                            <TabsContent value="custom-emoji">
                                <ScrollArea className="h-[350px]">
                                    <div className="p-2 grid grid-cols-8 gap-2">
                                        {customEmojiList.map(emojiUrl => (
                                            <button 
                                                key={emojiUrl} 
                                                onClick={() => handleCustomEmojiMessage(emojiUrl)}
                                                className="aspect-square flex items-center justify-center rounded-md hover:bg-accent"
                                            >
                                                <Image src={emojiUrl} alt={emojiUrl.split('/').pop() || ''} width={32} height={32} />
                                            </button>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                            <TabsContent value="emoji"><EmojiPicker onEmojiClick={handleEmojiClick} height={350} width="100%" defaultSkinTone={SkinTones.NEUTRAL} /></TabsContent>
                            <TabsContent value="stickers">
                                <ScrollArea className="h-[350px]">
                                    <div className="p-2 grid grid-cols-3 gap-2">
                                        {stickerList.map(stickerUrl => (
                                            <button 
                                                key={stickerUrl} 
                                                onClick={() => handleCustomEmojiMessage(stickerUrl)}
                                                className="aspect-square flex items-center justify-center rounded-md hover:bg-accent"
                                            >
                                                <Image src={stickerUrl} alt={stickerUrl.split('/').pop() || ''} width={96} height={96} />
                                            </button>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </PopoverContent>
                </Popover>
                <TooltipProvider>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleAttachmentClick}><Paperclip className="h-5 w-5"/></Button></TooltipTrigger><TooltipContent>Attach file</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleStartRecording}><Mic className="h-5 w-5"/></Button></TooltipTrigger><TooltipContent>Voice message</TooltipContent></Tooltip>
                </TooltipProvider>
                <Button size="icon" className="ml-2 h-8 w-8" onClick={() => editingMessage ? onSaveEdit() : handleSendMessage({ content: message })} disabled={isSending || !currentMessageValue.trim()}>
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingMessage ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
    );
}