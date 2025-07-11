
'use client';

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { useSwipeable } from 'react-swipeable';
import { MoreVertical, Paperclip, Phone, Send, Smile, Video, Mic, Check, CheckCheck, Pencil, Trash2, SmilePlus, X, FileIcon, Download, StopCircle, Copy, Star, Share2, Shield, Loader2, Pause, Play, StickyNote, Users, UserX, ShieldAlert, Pin, PinOff, Reply, Clock, CircleSlash, ArrowDown, AtSign, Image as ImageIcon, Info, Bold, Italic, Strikethrough, Code } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import TextareaAutosize from 'react-textarea-autosize';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Chat, User, Message, AttachmentMetadata } from '@/lib/types';
import { cn, getContrastingTextColor, createClient } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAppContext } from '@/providers/app-provider';
import EmojiPicker, { EmojiClickData, SkinTones } from 'emoji-picker-react';
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
import { VoiceNotePlayer } from './voice-note-player';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RequestDmDialog } from './request-dm-dialog';
import { Badge } from '@/components/ui/badge';
import { ForwardMessageDialog } from './forward-message-dialog';
import { ReportDialog } from './report-dialog';
import { PinnedMessagesDialog } from './pinned-messages-dialog';
import { LinkPreview } from './link-preview';
import { Icons } from "@/components/icons";
import { ImageViewerDialog } from './image-viewer';
import { MessageInfoDialog } from './message-info-dialog';
import { Textarea } from '@/components/ui/textarea';


interface ChatProps {
  chat: Chat;
  loggedInUser: User;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  highlightMessageId?: number | null;
  isLoadingMore: boolean;
  hasMoreMessages: boolean;
  topMessageSentinelRef: React.RefObject<HTMLDivElement>;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  initialUnreadCount?: number;
}

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

const formatRecordingTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const DELETED_MESSAGE_MARKER = '[[MSG_DELETED]]';
const SYSTEM_MESSAGE_PREFIX = '[[SYS:';

const FULL_MESSAGE_SELECT_QUERY = `
    *, 
    read_by,
    profiles!user_id(*), 
    replied_to_message:reply_to_message_id(*, profiles!user_id(*))
`;

const Spoiler = ({ content }: { content: string }) => {
    const [revealed, setRevealed] = useState(false);
    return (
        <span
            className="spoiler"
            data-revealed={revealed}
            onClick={() => setRevealed(true)}
            title="Click to reveal"
        >
            {content}
        </span>
    );
};

const parseMarkdown = (text: string | null) => {
    if (!text) return [];

    const elements: (string | React.ReactNode)[] = [];
    let lastIndex = 0;

    const regex = /(\*\*.*?\*\*|_.*?_|~~.*?~~|`.*?`|\|\|.*?\|\|)/g;

    text.replace(regex, (match, content, offset) => {
        if (offset > lastIndex) {
            elements.push(text.substring(lastIndex, offset));
        }

        if (match.startsWith('**') && match.endsWith('**')) {
            elements.push(<strong key={offset}>{match.slice(2, -2)}</strong>);
        } else if (match.startsWith('_') && match.endsWith('_')) {
            elements.push(<em key={offset}>{match.slice(1, -1)}</em>);
        } else if (match.startsWith('~~') && match.endsWith('~~')) {
            elements.push(<s key={offset}>{match.slice(2, -2)}</s>);
        } else if (match.startsWith('`') && match.endsWith('`')) {
            elements.push(<code key={offset} className="bg-muted text-muted-foreground font-mono text-sm px-1.5 py-1 rounded-md">{match.slice(1, -1)}</code>);
        } else if (match.startsWith('||') && match.endsWith('||')) {
            elements.push(<Spoiler key={offset} content={match.slice(2, -2)} />);
        } else {
            elements.push(match);
        }

        lastIndex = offset + match.length;
        return match;
    });

    if (lastIndex < text.length) {
        elements.push(text.substring(lastIndex));
    }

    return elements;
};

export function Chat({ chat, loggedInUser, setMessages, highlightMessageId, isLoadingMore, hasMoreMessages, topMessageSentinelRef, scrollContainerRef, initialUnreadCount = 0 }: ChatProps) {
    const { toast } = useToast();
    const { 
        themeSettings, 
        allUsers, 
        dmRequests, 
        leaveGroup,
        deleteGroup,
        forwardMessage,
        reportUser,
        blockUser,
        unblockUser,
        blockedUsers,
    } = useAppContext();
    const [message, setMessage] = useState('');
    const [caption, setCaption] = useState('');
    const [editingMessage, setEditingMessage] = useState<{ id: number; content: string } | null>(null);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [attachmentPreview, setAttachmentPreview] = useState<{ file: File, url: string } | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isRequestDmOpen, setIsRequestDmOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const attachmentInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
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
    
    const [messageToForward, setMessageToForward] = useState<Message | null>(null);

    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
    const [messageToReport, setMessageToReport] = useState<Message | null>(null);

    const [isPinnedDialogOpen, setIsPinnedDialogOpen] = useState(false);
    
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const [firstUnreadMentionId, setFirstUnreadMentionId] = useState<number | null>(null);
    
    const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
    const [imageViewerSrc, setImageViewerSrc] = useState('');
    
    const [messageInfo, setMessageInfo] = useState<Message | null>(null);
    
    const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
    const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number } | null>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);

    const hasScrolledOnLoad = useRef(false);

    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer) return;

        const handleScroll = () => {
            const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 400;
            setShowScrollToBottom(!isAtBottom);
        };

        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }, [scrollContainerRef]);

    useEffect(() => {
        if (initialUnreadCount > 0 && chat.messages && chat.messages.length > 0 && loggedInUser?.username) {
            const unreadMessages = chat.messages.slice(-initialUnreadCount);
            const mentionRegex = new RegExp(`@${loggedInUser.username}|@everyone`, 'i');
            
            const firstMention = unreadMessages.find(m => m.content && mentionRegex.test(m.content));

            if (firstMention) {
                setFirstUnreadMentionId(firstMention.id as number);
            }
        }
    }, [initialUnreadCount, chat.messages, loggedInUser?.username]);

    useEffect(() => {
        fetch('/api/assets')
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch assets: ${res.statusText}`);
                }
                return res.json();
            })
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                setStickerList(data.stickers || []);
                setCustomEmojiList(data.emojis || []);
            })
            .catch(err => console.error("Failed to load assets:", err));
    }, []);

    const supabase = createClient();

    const chatPartner = useMemo(() => {
        if (chat.type !== 'dm' || !chat.participants) return null;
        const partnerRecord = chat.participants.find(p => p.user_id !== loggedInUser.id);
        return partnerRecord?.profiles ?? null;
    }, [chat, loggedInUser.id]);
    
    const isGroup = chat.type === 'group' || chat.type === 'channel';

    const isChannel = chat.type === 'channel';
    const canPostInChannel = useMemo(() => 
        isChannel && chat.participants.find(p => p.user_id === loggedInUser.id)?.is_admin,
    [chat, loggedInUser.id, isChannel]);
    
    const isChatPartnerBlocked = useMemo(() => {
        if (!chatPartner || !blockedUsers) return false;
        return blockedUsers.includes(chatPartner.id);
    }, [blockedUsers, chatPartner]);
    
    const isGroupAdmin = useMemo(() => 
        isGroup && chat.participants.find(p => p.user_id === loggedInUser.id)?.is_admin, 
    [chat, loggedInUser.id, isGroup]);
    
    const pinnedMessages = useMemo(() => (chat.messages || []).filter(m => m.is_pinned), [chat.messages]);

    const isDmRestricted = useMemo(() => {
        if (chat.type !== 'dm' || !chatPartner || !dmRequests || loggedInUser.is_admin || chatPartner.is_admin) {
            return false;
        }

        if (!(loggedInUser.gender && chatPartner.gender && loggedInUser.gender !== chatPartner.gender)) {
            return false;
        }

        const hasPermission = dmRequests.some(req =>
            req.status === 'approved' &&
            ((req.from_user_id === loggedInUser.id && req.to_user_id === chatPartner.id) ||
             (req.from_user_id === chatPartner.id && req.to_user_id === loggedInUser.id))
        );
        
        const isChatWithGurudev = chatPartner?.role === 'gurudev';
        if (isChatWithGurudev && !loggedInUser.is_admin) {
            if ((chat.messages || []).length > 0) return false;
            return !hasPermission;
        }

        if (hasPermission) return false;

        if((chat.messages || []).length === 0 && !hasPermission) return true;

        return !hasPermission;
        
    }, [chat.type, loggedInUser, chatPartner, dmRequests, chat.messages]);
    
    const existingRequest = useMemo(() => {
        if (!chatPartner || !dmRequests) return null;
        return dmRequests.find(req =>
            ((req.from_user_id === loggedInUser.id && req.to_user_id === chatPartner.id) ||
             (req.from_user_id === chatPartner.id && req.to_user_id === loggedInUser.id))
        );
    }, [dmRequests, loggedInUser, chatPartner]);

    const jumpToMessage = useCallback((messageId: number) => {
        setIsPinnedDialogOpen(false);
        const messageElement = document.getElementById(`message-${messageId}`);
        if (messageElement) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            messageElement.classList.add('animate-highlight');
            setTimeout(() => {
                messageElement.classList.remove('animate-highlight');
            }, 1500);
        } else {
            toast({ variant: 'destructive', title: 'Message not found', description: 'The original message may not be loaded.' });
        }
    }, [toast]);

    useEffect(() => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer || !messagesEndRef.current) return;
    
      const highlightedElement = highlightMessageId ? document.getElementById(`message-${highlightMessageId}`) : null;

      if (highlightedElement) {
        jumpToMessage(highlightMessageId as number);
        hasScrolledOnLoad.current = true; // prevent scrolling to bottom
        return;
      }
      
      if (!hasScrolledOnLoad.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        hasScrolledOnLoad.current = true;
      }
    }, [chat.messages, highlightMessageId, jumpToMessage, scrollContainerRef]);
    
    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer) return;
    
        const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 200;
        if (isNearBottom) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chat.messages?.length, scrollContainerRef]);


    useEffect(() => {
      if (mentionQuery !== null) {
        setActiveMentionIndex(0);
      }
    }, [mentionQuery]);
    
    const handleSendMessage = async ({ content, contentToSave, attachment }: { content: string, contentToSave?: string, attachment?: { file: File, url: string }}) => {
        if (isSending || (content.trim() === '' && !attachment)) return;
        
        setIsSending(true);
        const tempId = `temp-${uuidv4()}`;
        
        const optimisticMessage: Message = {
          id: tempId,
          created_at: new Date().toISOString(),
          chat_id: chat.id,
          user_id: loggedInUser.id,
          content: content.trim(),
          attachment_url: attachment ? attachment.url : null,
          attachment_metadata: attachment ? { name: attachment.file.name, type: attachment.file.type, size: attachment.file.size } : null,
          reply_to_message_id: replyingTo?.id,
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
            let attachmentMetadata: AttachmentMetadata | null = null;
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
                attachmentMetadata = { name: file.name, type: file.type, size: file.size };
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
                    reply_to_message_id: replyingTo?.id,
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
            reply_to_message_id: replyingTo?.id,
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
                    reply_to_message_id: replyingTo?.id,
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
    
    const handleSaveEdit = async () => {
        if (!editingMessage) return;
        const { error } = await supabase
            .from('messages')
            .update({ content: editingMessage.content, is_edited: true })
            .eq('id', editingMessage.id);
        
        if (error) {
            toast({ variant: 'destructive', title: "Error editing message", description: error.message });
        } else {
             setEditingMessage(null);
        }
    };

    const handleDeleteForEveryone = async (messageId: number) => {
        const originalMessages = chat.messages || [];
        const newMessages = originalMessages.map(m => 
            m.id === messageId 
            ? { ...m, content: DELETED_MESSAGE_MARKER, attachment_url: null, attachment_metadata: null, reactions: null, is_edited: false } 
            : m
        );
        setMessages(newMessages);

        const { error } = await supabase
            .from('messages')
            .update({ 
                content: DELETED_MESSAGE_MARKER, 
                attachment_url: null, 
                attachment_metadata: null, 
                reactions: null,
                is_edited: false
            })
            .eq('id', messageId);

        if (error) {
            toast({ variant: 'destructive', title: "Error deleting message", description: error.message });
            setMessages(originalMessages);
        }
    };
    
    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: 'Copied to clipboard' });
    };

    const handleStartEdit = (message: Message) => {
        setReplyingTo(null);
        setEditingMessage({ id: message.id as number, content: message.content || '' });
    };

    const handleStartReply = (message: Message) => {
        setEditingMessage(null);
        setReplyingTo(message);
        textareaRef.current?.focus();
    };

    const handleCancelEdit = () => setEditingMessage(null);

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

    const handleReaction = async (message: Message, emoji: string) => {
        if (typeof message.id === 'string') {
             toast({ variant: 'destructive', title: 'Cannot react yet', description: 'Please wait for the message to be sent.' });
             return;
        }
        const { error } = await supabase.rpc('toggle_reaction', { 
            p_message_id: message.id, 
            p_user_id: loggedInUser.id, 
            p_emoji: emoji 
        });
        
        if (error) {
            toast({ variant: 'destructive', title: 'Error updating reaction', description: error.message });
        }
    };
    
    const onReact = (emojiData: EmojiClickData, message: Message) => {
        handleReaction(message, emojiData.emoji);
    };
    
    const onCustomReact = (emojiUrl: string, message: Message) => {
      handleReaction(message, emojiUrl);
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
                await handleSendMessage({ content: '', attachment: { file: audioFile, url: optimisticUrl } });
                
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
        setMessage(value);

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
    
    const handleTextSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
  
      if (start === end) {
        setSelection(null);
        setToolbarPosition(null);
        return;
      }
  
      setSelection({ start, end });
  
      const getCaretCoordinates = (element: any, position: number) => {
        const debug = false;
        const 'selectionStart' = position;
        const 'selectionEnd' = position;
        const properties = [
            'direction',
            'boxSizing',
            'width',
            'height',
            'overflowX',
            'overflowY',
            'borderTopWidth',
            'borderRightWidth',
            'borderBottomWidth',
            'borderLeftWidth',
            'paddingTop',
            'paddingRight',
            'paddingBottom',
            'paddingLeft',
            'fontStyle',
            'fontVariant',
            'fontWeight',
            'fontStretch',
            'fontSize',
            'fontSizeAdjust',
            'lineHeight',
            'fontFamily',
            'textAlign',
            'textTransform',
            'textIndent',
            'textDecoration',
            'letterSpacing',
            'wordSpacing',
            'tabSize',
            'MozTabSize',
        ];

        const isBrowser = typeof window !== 'undefined';
        const isFirefox = isBrowser && (window as any).mozInnerScreenX != null;
    
        const div = document.createElement('div');
        div.id = 'input-textarea-caret-position-mirror-div';
        document.body.appendChild(div);
    
        const style = div.style;
        const computed = window.getComputedStyle(element);
    
        style.whiteSpace = 'pre-wrap';
        style.wordWrap = 'break-word';
        style.position = 'absolute';
        if (!debug) style.visibility = 'hidden';
    
        properties.forEach(prop => {
            style[prop as any] = computed[prop as any];
        });
    
        if (isFirefox) {
            if (element.scrollHeight > parseInt(computed.height))
                style.overflowY = 'scroll';
        } else {
            style.overflow = 'hidden';
        }
    
        div.textContent = element.value.substring(0, position);
    
        const span = document.createElement('span');
        span.textContent = element.value.substring(position) || '.';
        div.appendChild(span);
    
        const coordinates = {
            top: span.offsetTop + parseInt(computed.borderTopWidth),
            left: span.offsetLeft + parseInt(computed.borderLeftWidth),
            height: parseInt(computed.lineHeight)
        };
    
        if (debug) {
            span.style.backgroundColor = '#aaa';
        } else {
            document.body.removeChild(div);
        }
    
        return coordinates;
      };
  
      const rect = textarea.getBoundingClientRect();
      const caretPos = getCaretCoordinates(textarea, start);
      
      setToolbarPosition({
        top: rect.top + caretPos.top - caretPos.height - 10,
        left: rect.left + caretPos.left,
      });
    };

    const applyFormatting = (format: 'bold' | 'italic' | 'strikethrough' | 'code') => {
        if (!selection || !textareaRef.current) return;

        const { start, end } = selection;
        const selectedText = message.substring(start, end);
        let prefix, suffix;

        switch (format) {
            case 'bold': prefix = '**'; suffix = '**'; break;
            case 'italic': prefix = '_'; suffix = '_'; break;
            case 'strikethrough': prefix = '~~'; suffix = '~~'; break;
            case 'code': prefix = '`'; suffix = '`'; break;
        }

        const newText = 
            message.substring(0, start) +
            prefix + selectedText + suffix +
            message.substring(end);

        setMessage(newText);
        
        // Refocus textarea and set cursor position after state update
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
        const textBeforeCursor = message.substring(0, cursorPosition);
        
        const mentionMatch = textBeforeCursor.match(/@([\w\d_]*)$/);
        if (!mentionMatch) return;

        const startIndex = mentionMatch.index || 0;
        const newText = 
            message.substring(0, startIndex) +
            `@${username} ` +
            message.substring(cursorPosition);
        
        setMessage(newText);
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
        }
    };
    
    const sendSystemMessage = async (text: string) => {
        const { error } = await supabase.from('messages').insert({
            chat_id: chat.id,
            user_id: loggedInUser.id,
            content: `${SYSTEM_MESSAGE_PREFIX}${text}]]`
        });
        if (error) {
            toast({ variant: 'destructive', title: "Error sending system message", description: error.message });
        }
    };

    const handleToggleStar = async (messageToStar: Message) => {
        if (typeof messageToStar.id === 'string') return;
        const { error } = await supabase
            .from('messages')
            .update({ is_starred: !messageToStar.is_starred })
            .eq('id', messageToStar.id);
        
        if (error) {
            toast({ variant: 'destructive', title: 'Error starring message', description: error.message });
        }
    };

    const handleTogglePin = async (messageToPin: Message) => {
        if (isGroup && !isGroupAdmin) return;
        if (typeof messageToPin.id === 'string') return;

        const newIsPinned = !messageToPin.is_pinned;

        const { error } = await supabase
            .from('messages')
            .update({ is_pinned: newIsPinned })
            .eq('id', messageToPin.id);

        if (error) {
            toast({ variant: 'destructive', title: 'Error pinning message', description: error.message });
        } else {
            if (newIsPinned) {
                sendSystemMessage(`📌 ${loggedInUser.name} pinned a message.`);
            }
            toast({ title: newIsPinned ? 'Message pinned' : 'Message unpinned' });
        }
    };

    const handleScrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleJumpToMention = () => {
        if (firstUnreadMentionId) {
            jumpToMessage(firstUnreadMentionId);
            setFirstUnreadMentionId(null);
        }
    };

    const wallpaperStyle = {
      backgroundImage: themeSettings.chatWallpaper ? `url(${themeSettings.chatWallpaper})` : `url('/chat-bg.png')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      filter: `brightness(${themeSettings.wallpaperBrightness / 100})`,
      backgroundRepeat: themeSettings.chatWallpaper?.startsWith('/chat-bg.png') ? 'repeat' : 'no-repeat',
    };

    const outgoingBubbleStyle = {
      backgroundColor: themeSettings.outgoingBubbleColor,
      color: getContrastingTextColor(themeSettings.outgoingBubbleColor),
    };

    const incomingBubbleStyle = {
      backgroundColor: themeSettings.incomingBubbleColor,
      color: getContrastingTextColor(themeSettings.incomingBubbleColor),
    };

    const getMessageStatus = (message: Message) => {
        const isMyMessage = message.user_id === loggedInUser.id;
        if (!isMyMessage) return null;
        
        if (typeof message.id === 'string' && message.id.startsWith('temp-')) {
          return 'pending';
        }

        const otherParticipants = chat.participants.filter(p => p.user_id !== loggedInUser.id);
        if (otherParticipants.length === 0) return 'sent';

        const allRead = otherParticipants.every(p => message.read_by?.includes(p.user_id));

        return allRead ? 'read' : 'sent';
    }
    
    const parseContent = useCallback((content: string | null): (string | React.ReactNode)[] => {
        if (!content) return [];

        let processedContent = content;

        // Early return for forwarded messages to handle them separately
        if (processedContent.startsWith('Forwarded from')) {
            const parts = processedContent.split('\n');
            const forwardLine = parts[0];
            const restOfContent = parts.slice(1).join('\n');
            return [
                <span key="forwarded-line" className="block text-xs italic opacity-80 font-semibold mb-2">
                    {forwardLine.replace(/\*\*/g, '')}
                </span>,
                ...parseMarkdown(restOfContent)
            ];
        }

        const elements: (string | React.ReactNode)[] = [];
        let lastIndex = 0;

        const emojiMap = new Map(customEmojiList.map(url => {
            const name = url.split('/').pop()?.split('.')[0] || 'custom_emoji';
            return [name, url];
        }));

        const combinedRegex = /(https?:\/\/[^\s]+)|(@[\w\d_]+)|(:[a-zA-Z0-9_]+:)/g;

        const parsedWithMarkdown = parseMarkdown(content);

        const processNode = (node: string | React.ReactNode): (string | React.ReactNode)[] => {
            if (typeof node !== 'string') return [node];

            const subElements: (string | React.ReactNode)[] = [];
            let subLastIndex = 0;

            node.replace(combinedRegex, (match, url, mention, emoji, offset) => {
                 if (offset > subLastIndex) {
                    subElements.push(node.substring(subLastIndex, offset));
                }

                if (mention) {
                    const username = mention.substring(1);
                    const isEveryone = username === 'everyone';
                    const mentionedUser = allUsers?.find(u => u.username === username);
                    if (isEveryone || mentionedUser) {
                        const isMe = mentionedUser && loggedInUser && mentionedUser.id === loggedInUser.id;
                        subElements.push(
                            <span key={`mention-${offset}`} className={cn("font-semibold rounded-sm px-1", isMe ? "bg-amber-400/30 text-amber-800 dark:text-amber-200" : "bg-primary/20 text-primary")}>
                                {match}
                            </span>
                        );
                    } else {
                        subElements.push(match);
                    }
                } else if (emoji) {
                    const emojiName = emoji.substring(1, emoji.length - 1);
                    const emojiUrl = emojiMap.get(emojiName);
                    if (emojiUrl) {
                        subElements.push(
                            <Image key={`emoji-${offset}`} src={emojiUrl} alt={emojiName} width={28} height={28} className="inline-block align-text-bottom mx-0.5" />
                        );
                    } else {
                        subElements.push(match);
                    }
                } else if (url) {
                    const metadata = { type: 'link_preview', url, name: url, size: 0 };
                    subElements.push(
                        <LinkPreview key={`url-${offset}`} metadata={metadata} />
                    );
                }

                subLastIndex = offset + match.length;
                return match;
            });
            
            if (subLastIndex < node.length) {
                subElements.push(node.substring(subLastIndex));
            }

            return subElements;
        }

        parsedWithMarkdown.forEach(node => {
            elements.push(...processNode(node));
        });

        return elements;

    }, [customEmojiList, allUsers, loggedInUser?.id]);

    const renderMessageContent = (message: Message) => {
        if (message.attachment_url) {
            const { type = '', name = 'attachment', size = 0 } = message.attachment_metadata || {};

            if (type === 'event_share' && message.attachment_metadata?.eventId) {
                const metadata = message.attachment_metadata;
                return (
                    <Link href={`/events/${metadata.eventId}`} className="block">
                        <Card className="bg-background/20 backdrop-blur-sm overflow-hidden hover:bg-background/30 transition-colors">
                            <div className="relative aspect-video w-full">
                                 <Image 
                                    src={metadata.eventThumbnail || 'https://placehold.co/600x400.png'} 
                                    alt={name} 
                                    fill 
                                    className="object-cover"
                                    data-ai-hint="event"
                                    sizes="(max-width: 768px) 80vw, 320px"
                                />
                            </div>
                            <CardHeader className="p-3">
                                <CardTitle className="text-base line-clamp-2" style={{color: 'inherit'}}>{name}</CardTitle>
                                {metadata.eventDate && (
                                    <CardDescription className="text-xs" style={{color: 'inherit', opacity: 0.8}}>{format(new Date(metadata.eventDate), 'eeee, MMM d, yyyy @ p')}</CardDescription>
                                )}
                            </CardHeader>
                        </Card>
                    </Link>
                );
            }

            const isSticker = name === 'sticker.webp';

            const attachmentElement = () => {
                if (isSticker) {
                    return (
                         <Image
                            src={message.attachment_url!}
                            alt="Sticker"
                            width={160}
                            height={160}
                            className="object-contain"
                        />
                    );
                }
                if (type.startsWith('image/')) {
                     return (
                        <button
                          className="relative block w-full max-w-xs cursor-pointer overflow-hidden rounded-lg border bg-muted"
                          onClick={() => {
                            setImageViewerSrc(message.attachment_url!);
                            setIsImageViewerOpen(true);
                          }}
                        >
                            <Image
                                src={message.attachment_url!}
                                alt={name || 'Attached image'}
                                width={320}
                                height={240}
                                className="h-auto w-full object-cover transition-transform group-hover/bubble:scale-105"
                                sizes="(max-width: 768px) 80vw, 320px"
                            />
                        </button>
                    );
                }
                if (type.startsWith('audio/')) {
                    return <VoiceNotePlayer src={message.attachment_url!} isMyMessage={message.user_id === loggedInUser.id} />;
                }
                
                const truncateFileName = (fileName: string, maxLength: number = 25) => {
                    if (fileName.length <= maxLength) return fileName;
                    const extension = fileName.split('.').pop() || '';
                    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
                    const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 4);
                    return `${truncatedName}...${extension ? `.${extension}` : ''}`;
                };

                return (
                    <div className="flex w-full max-w-full items-center gap-2 sm:gap-3 rounded-md border bg-background/20 p-2 sm:p-3 backdrop-blur-sm min-w-0">
                        <FileIcon className="h-6 w-6 sm:h-8 sm:w-8 shrink-0 text-current/80" />
                        <div className="flex-grow min-w-0 overflow-hidden">
                            <p className="font-semibold text-sm sm:text-base truncate break-all" title={name}>
                                <span className="sm:hidden">{truncateFileName(name, 15)}</span>
                                <span className="hidden sm:inline">{truncateFileName(name, 30)}</span>
                            </p>
                            <p className="text-xs opacity-80">{formatBytes(size)}</p>
                        </div>
                        <a 
                            href={message.attachment_url!} 
                            download={name} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="shrink-0"
                        >
                            <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-8 sm:w-8">
                                <Download className="h-4 w-4 sm:h-5 sm:w-5" />
                            </Button>
                        </a>
                    </div>
                );
            };
            
            const showCaption = message.content && !type.startsWith('audio/') && !isSticker;

            return (
                <div className="space-y-2 break-words min-w-0">
                    {attachmentElement()}
                    {showCaption && <p className="whitespace-pre-wrap break-words">{parseContent(message.content)}</p>}
                </div>
            );
        }
        return <p className="whitespace-pre-wrap break-words">{parseContent(message.content)}</p>;
    }
    
    const reactionPickerCustomEmojis = useMemo(() => {
        return customEmojiList.map(url => ({
            id: url,
            names: [url.split('/').pop()?.split('.')[0] || 'custom'],
            img: url,
        }));
    }, [customEmojiList]);

    const renderReactions = (message: Message) => {
      if (!message.reactions || Object.keys(message.reactions).length === 0) return null;
      
      const isOptimistic = typeof message.id === 'string';

      return (
        <div className="absolute -bottom-4 -right-2 flex gap-1">
          {Object.entries(message.reactions).map(([emoji, userIds]) => {
            const hasReacted = userIds.includes(loggedInUser.id);
            const isCustom = emoji.startsWith('/');
            return (
              <TooltipProvider key={emoji}>
                <Tooltip>
                  <TooltipTrigger asChild>
                     <button
                        onClick={() => handleReaction(message, emoji)}
                        disabled={isOptimistic}
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition-colors",
                          hasReacted ? "bg-primary/20 border border-primary" : "bg-background/80 border"
                        )}
                      >
                        {isCustom ? (
                            <Image src={emoji} alt="reaction" width={16} height={16} />
                        ) : (
                           <span>{emoji}</span>
                        )}
                        <span>{userIds.length}</span>
                      </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">
                      {userIds.map(id => allUsers.find(u => u.id === id)?.name || '...').join(', ')}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          })}
        </div>
      )
    }

    const messagesWithSeparators = useMemo(() => {
        if (!chat.messages || chat.messages.length === 0) return [];
    
        const items: (Message | { type: 'separator' | 'unread_separator'; id: string; date: string })[] = [];
        let lastDate: Date | null = null;
        
        const unreadIndex = initialUnreadCount > 0 && initialUnreadCount < chat.messages.length 
            ? chat.messages.length - initialUnreadCount 
            : -1;

        chat.messages.forEach((message, index) => {
            const messageDate = new Date(message.created_at);
            if (!lastDate || !isSameDay(messageDate, lastDate)) {
                let label = '';
                if (isToday(messageDate)) {
                    label = 'Today';
                } else if (isYesterday(messageDate)) {
                    label = 'Yesterday';
                } else {
                    label = format(messageDate, 'MMMM d, yyyy');
                }
                items.push({ type: 'separator', id: `sep-${message.id}`, date: label });
            }
            if (index === unreadIndex) {
                 items.push({ type: 'unread_separator', id: 'unread-separator', date: '' });
            }
            items.push(message);
            lastDate = messageDate;
        });
    
        return items;
    }, [chat.messages, initialUnreadCount]);

    const DateSeparator = ({ date }: { date: string }) => (
        <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center">
                <span className="bg-muted px-3 text-xs font-medium text-muted-foreground rounded-full">
                    {date}
                </span>
            </div>
        </div>
    );

    const UnreadSeparator = () => (
        <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-red-500" />
            </div>
            <div className="relative flex justify-center">
                <span className="bg-red-500 px-3 text-xs font-medium text-white rounded-full">
                    Unread Messages
                </span>
            </div>
        </div>
    );

    const SystemMessage = ({ content }: { content: string }) => {
        const parsedContent = content.replace(SYSTEM_MESSAGE_PREFIX, '').replace(']]', '');
        const icon = parsedContent.startsWith('📌') ? <Pin className="inline-block h-3 w-3 mr-1.5" /> : null;
        
        return (
            <div className="text-center text-xs text-muted-foreground my-3">
                <span className="bg-muted px-2.5 py-1.5 rounded-full">
                    {icon}
                    {parsedContent.replace('📌 ', '')}
                </span>
            </div>
        );
    }
  
  const MessageBubble = ({ message }: { message: Message }) => {
    if (message.content && message.content.startsWith(SYSTEM_MESSAGE_PREFIX)) {
        return <SystemMessage content={message.content} />;
    }
    
    if (message.content === DELETED_MESSAGE_MARKER) {
        const isMyMessage = message.user_id === loggedInUser.id;
        const bubbleStyle = isMyMessage ? outgoingBubbleStyle : incomingBubbleStyle;
        return (
            <div className={cn("flex items-end gap-2 group/message", isMyMessage ? "justify-end" : "justify-start")}>
                 {!isMyMessage && <div className="w-8" />}
                 <div
                    className="relative max-w-[85%] sm:max-w-md lg:max-w-lg rounded-lg text-sm px-2 sm:px-3 py-2"
                    style={bubbleStyle}
                 >
                    <div className="flex items-center gap-2 italic text-current/70">
                        <CircleSlash className="h-4 w-4" />
                        <span>This message was deleted</span>
                    </div>
                </div>
                 {isMyMessage && <div className="w-8" />}
            </div>
        );
    }

    const isMyMessage = message.user_id === loggedInUser.id;
    const sender = message.profiles;
    const isEditing = editingMessage?.id === message.id;
    const messageStatus = getMessageStatus(message);
    const isOptimistic = typeof message.id === 'string';

    const swipeHandlers = useSwipeable({
      onSwipedRight: () => {
        if (!isMyMessage && !isOptimistic) handleStartReply(message);
      },
      onSwipedLeft: () => {
        if (isMyMessage && !isOptimistic) handleStartReply(message);
      },
      trackMouse: true,
      preventScrollOnSwipe: true,
    });

    if (!sender) {
        return <div key={message.id}>Loading message...</div>;
    }
    
    const bubbleStyle = isMyMessage ? outgoingBubbleStyle : incomingBubbleStyle;
    const senderName = isGroup && sender.role === 'gurudev' ? chat.name : sender.name;
    const senderAvatar = sender.avatar_url;
    const senderFallback = (senderName || 'U').charAt(0);

    const ReplyPreview = ({ repliedTo }: { repliedTo: Message }) => (
      <div
        className="flex items-center gap-2 p-2 mb-2 rounded-md cursor-pointer border-l-2 bg-foreground/[.07] dark:bg-foreground/[.1] hover:bg-foreground/[.1] dark:hover:bg-foreground/[.15] transition-colors"
        style={{ borderColor: themeSettings.usernameColor }}
        onClick={() => jumpToMessage(repliedTo.id as number)}
      >
        <div className="flex-1 overflow-hidden">
          <p className="font-semibold text-sm truncate" style={{ color: themeSettings.usernameColor }}>
            {repliedTo.profiles.name}
          </p>
          <p className="text-xs truncate opacity-80" style={{ color: 'inherit', opacity: 0.8 }}>
            {repliedTo.content || (repliedTo.attachment_metadata?.name || 'Attachment')}
          </p>
        </div>
      </div>
    );
    
    return (
      <div key={message.id} id={`message-${message.id}`} className={cn(
          "flex items-end gap-2 group/message",
          isMyMessage ? "justify-end" : "justify-start",
          message.id === highlightMessageId && "rounded-lg"
      )}>
      {!isMyMessage && (
          <Avatar className="h-8 w-8 self-end">
          <AvatarImage src={senderAvatar} alt={senderName} data-ai-hint="avatar" />
          <AvatarFallback>{senderFallback}</AvatarFallback>
          </Avatar>
      )}
      <div {...swipeHandlers} className={cn("relative transition-transform duration-200 ease-out", isMyMessage ? "group-data-[swiped=true]/message:translate-x-[-2rem]" : "group-data-[swiped=true]/message:translate-x-[2rem]")}>
          <div 
              className={cn("group/bubble relative max-w-[85%] sm:max-w-[80%] md:max-w-md lg:max-w-lg rounded-lg text-sm px-2 sm:px-3 py-2 break-words min-w-0")}
              style={bubbleStyle}
          >
              {isEditing ? (
                  <div className="w-full">
                      <Textarea
                          value={editingMessage.content}
                          onChange={(e) => setEditingMessage({ ...editingMessage, content: e.target.value })}
                          className="w-full resize-none bg-background text-foreground"
                          rows={3}
                      />
                      <div className="mt-2 flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={handleCancelEdit}>Cancel</Button>
                          <Button size="sm" onClick={handleSaveEdit}>Save changes</Button>
                      </div>
                  </div>
              ) : (
                  <>
                      {isGroup && !isMyMessage && (
                          <div className="flex items-center gap-2 font-semibold mb-1 text-sm">
                              <span style={{ color: themeSettings.usernameColor }}>
                                  {senderName}
                              </span>
                              {sender.role === 'gurudev' && (
                                  <Badge variant="destructive" className="text-xs px-1.5 py-0 leading-none">Gurudev</Badge>
                              )}
                          </div>
                      )}
                      {message.replied_to_message && <ReplyPreview repliedTo={message.replied_to_message} />}
                      {renderMessageContent(message)}
                      <div className="text-xs mt-1 flex items-center gap-1.5 opacity-70" style={{ justifyContent: isMyMessage ? 'flex-end' : 'flex-start' }}>
                          {message.is_pinned && <Pin className="h-3 w-3 text-current mr-1" />}
                          {message.is_edited && <span className="text-xs italic">Edited</span>}
                          {message.is_starred && <Star className="h-3 w-3 text-amber-400 fill-amber-400 mr-1" />}
                          <span>{format(new Date(message.created_at), 'p')}</span>
                          {isMyMessage && messageStatus === 'pending' && <Clock className="h-4 w-4" />}
                          {isMyMessage && messageStatus === 'sent' && <Check className="h-4 w-4" />}
                          {isMyMessage && messageStatus === 'read' && <CheckCheck className="h-4 w-4 text-primary" />}
                      </div>
                  </>
              )}
              
              {!isEditing && (
                  <div className={cn(
                      "absolute -top-4 flex items-center gap-1 opacity-0 group-hover/bubble:opacity-100 transition-opacity",
                      isMyMessage ? "left-[-8px]" : "right-[-8px]"
                  )}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-background/80 hover:bg-background" onClick={() => handleStartReply(message)} disabled={isOptimistic}>
                          <Reply className="h-4 w-4" />
                        </Button>
                       <Popover>
                          <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-background/80 hover:bg-background" disabled={isOptimistic}>
                                  <SmilePlus className="h-4 w-4" />
                              </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 border-none">
                              <EmojiPicker 
                                onEmojiClick={(emojiData) => onReact(emojiData, message)} 
                                customEmojis={reactionPickerCustomEmojis}
                                onCustomEmojiClick={(emojiData) => onCustomReact(emojiData.id, message)}
                                defaultSkinTone={SkinTones.NEUTRAL}
                                getEmojiUrl={(unified, style) => `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/${style}/64/${unified}.png`}
                              />
                          </PopoverContent>
                      </Popover>
                      <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-background/80 hover:bg-background">
                                  <MoreVertical className="h-4 w-4" />
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleStartReply(message)} disabled={isOptimistic}>
                                <Reply className="mr-2 h-4 w-4" />
                                <span>Reply</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setMessageToForward(message)} disabled={isOptimistic}>
                                  <Share2 className="mr-2 h-4 w-4" />
                                  <span>Forward</span>
                              </DropdownMenuItem>
                              {message.content && (
                                  <DropdownMenuItem onClick={() => handleCopy(message.content as string)}>
                                      <Copy className="mr-2 h-4 w-4" />
                                      <span>Copy</span>
                                  </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleToggleStar(message)} disabled={isOptimistic}>
                                  <Star className="mr-2 h-4 w-4" />
                                  <span>{message.is_starred ? 'Unstar' : 'Star'}</span>
                              </DropdownMenuItem>
                               <DropdownMenuItem onClick={() => handleTogglePin(message)} disabled={(isGroup && !isGroupAdmin) || isOptimistic}>
                                  {message.is_pinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}
                                  <span>{message.is_pinned ? 'Unpin' : 'Pin'}</span>
                              </DropdownMenuItem>
                               {isMyMessage && isGroup && !isOptimistic && (
                                  <DropdownMenuItem onClick={() => setMessageInfo(message)}>
                                      <Info className="mr-2 h-4 w-4" />
                                      <span>Message Info</span>
                                  </DropdownMenuItem>
                              )}
                               {!isMyMessage && (
                                  <DropdownMenuItem onClick={() => { setMessageToReport(message); setIsReportDialogOpen(true); }} disabled={isOptimistic}>
                                      <ShieldAlert className="mr-2 h-4 w-4" />
                                      <span>Report Message</span>
                                  </DropdownMenuItem>
                              )}
                              {isMyMessage && !isOptimistic && (
                              <>
                                  <DropdownMenuSeparator />
                                  {message.content && (
                                      <DropdownMenuItem onClick={() => handleStartEdit(message)}>
                                          <Pencil className="mr-2 h-4 w-4" />
                                          <span>Edit</span>
                                      </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteForEveryone(message.id as number)}>
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      <span>Delete for everyone</span>
                                  </DropdownMenuItem>
                              </>
                              )}
                          </DropdownMenuContent>
                      </DropdownMenu>
                  </div>
              )}
              {renderReactions(message)}
          </div>
        </div>
      {isMyMessage && (
          <Avatar className="h-8 w-8 self-end">
              <AvatarImage src={loggedInUser.avatar_url} alt={loggedInUser.name} data-ai-hint="avatar" />
              <AvatarFallback>{loggedInUser.name?.charAt(0)}</AvatarFallback>
          </Avatar>
      )}
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
        <ImageViewerDialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen} src={imageViewerSrc} />
        {chatPartner && <RequestDmDialog open={isRequestDmOpen} onOpenChange={setIsRequestDmOpen} targetUser={chatPartner} />}
        {messageToForward && <ForwardMessageDialog open={!!messageToForward} messageToForward={messageToForward} onOpenChange={(open) => !open && setMessageToForward(null)} />}
        {messageInfo && <MessageInfoDialog message={messageInfo} chat={chat} open={!!messageInfo} onOpenChange={() => setMessageInfo(null)} />}
        {chatPartner && <ReportDialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen} userToReport={chatPartner} messageToReport={messageToReport} />}
        <PinnedMessagesDialog
            open={isPinnedDialogOpen}
            onOpenChange={setIsPinnedDialogOpen}
            messages={pinnedMessages}
            onJumpToMessage={jumpToMessage}
            onUnpinMessage={(id) => {
                const msg = chat.messages?.find(m => m.id === id);
                if (msg) handleTogglePin(msg);
            }}
            isAdmin={isGroupAdmin || false}
        />
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Send Attachment</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                    <div className="flex justify-center items-center bg-muted rounded-md p-4 min-h-[300px] max-h-[60vh] overflow-hidden">
                        {attachmentPreview?.file.type.startsWith('image/') ? (
                            <Image
                                src={attachmentPreview.url}
                                alt={attachmentPreview.file.name}
                                width={500}
                                height={400}
                                className="rounded-md object-contain h-full w-auto"
                            />
                        ) : attachmentPreview ? (
                            <div className="flex flex-col items-center justify-center gap-4 text-center">
                                <FileIcon className="h-16 w-16 text-muted-foreground" />
                                <p className="font-semibold text-foreground max-w-full truncate px-4">{attachmentPreview.file.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {formatBytes(attachmentPreview.file.size)}
                                </p>
                            </div>
                        ) : null}
                    </div>
                    <Textarea
                        placeholder="Add a caption..."
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="resize-none"
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={() => handleSendMessage({ content: caption, attachment: attachmentPreview! })} disabled={isSending}>
                        {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Send
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      <header className="flex items-center justify-between p-2 border-b gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
            <div className="md:hidden">
                <SidebarTrigger />
            </div>
            <Link href={isGroup ? `/group/${chat.id}` : `/profile/${chatPartner?.username || ''}`} className="flex-shrink-0">
              <Avatar className="h-10 w-10">
                  <AvatarImage src={isGroup ? chat.avatar_url : chatPartner?.avatar_url} alt={isGroup ? chat.name : chatPartner?.name} data-ai-hint={isGroup ? 'group symbol' : 'avatar'} />
                  <AvatarFallback>{(isGroup ? chat.name : chatPartner?.name)?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex flex-col truncate">
                <Link href={isGroup ? `/group/${chat.id}` : `/profile/${chatPartner?.username || ''}`}>
                  <span className="font-semibold hover:underline truncate">{isGroup ? chat.name : chatPartner?.name}</span>
                </Link>
                <span className="text-xs text-muted-foreground truncate">
                  {isGroup ? `${chat.participants?.length} members` : chatPartner ? `@${chatPartner.username}` : ''}
                </span>
            </div>
        </div>
        <div className="flex items-center gap-1">
            {pinnedMessages.length > 0 && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setIsPinnedDialogOpen(true)}>
                                <Pin className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>View Pinned Messages</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
            <Button variant="ghost" size="icon" onClick={() => toast({ title: "Coming Soon", description: "Voice calls will be available soon." })}><Phone className="h-5 w-5"/></Button>
            <Button variant="ghost" size="icon" onClick={() => toast({ title: "Coming Soon", description: "Video calls will be available soon." })}><Video className="h-5 w-5"/></Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <MoreVertical />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild><Link href={isGroup ? `/group/${chat.id}` : `/profile/${chatPartner?.username || ''}`}>View Info</Link></DropdownMenuItem>
                    {chatPartner && <DropdownMenuItem onClick={() => { setMessageToReport(null); setIsReportDialogOpen(true); }}>Report User</DropdownMenuItem>}
                    {chatPartner && (
                      <DropdownMenuItem onClick={() => isChatPartnerBlocked ? unblockUser(chatPartner.id) : blockUser(chatPartner.id)}>
                        {isChatPartnerBlocked ? 'Unblock User' : 'Block User'}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>Clear chat</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </header>
      
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0 z-0" style={wallpaperStyle} />
        <ScrollArea viewportRef={scrollContainerRef} className="absolute inset-0 h-full w-full">
            <div className="p-4 space-y-6">
                <div ref={topMessageSentinelRef} className="h-px">
                  {isLoadingMore && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                  {!hasMoreMessages && (chat.messages || []).length > 0 && (
                    <div className="text-center text-xs text-muted-foreground py-4">
                      You've reached the beginning of this chat.
                    </div>
                  )}
                </div>
                {(messagesWithSeparators || [])
                .filter(item => {
                    if (!('user_id' in item) || !item.user_id) return true;
                    if (!blockedUsers) return true;
                    return !blockedUsers.includes(item.user_id);
                })
                .map((item) => {
                    if (item.type === 'separator') {
                        return <DateSeparator key={item.id} date={item.date} />;
                    }
                    if (item.type === 'unread_separator') {
                        return <UnreadSeparator key="unread-separator" />;
                    }
                    const message = item as Message;
                    return <MessageBubble key={message.id} message={message} />
                })}
                <div ref={messagesEndRef} />
            </div>
        </ScrollArea>
        <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-2">
            {firstUnreadMentionId && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button size="icon" className="rounded-full shadow-lg h-10 w-10" onClick={handleJumpToMention}>
                                <AtSign className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Jump to unread mention</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
            {showScrollToBottom && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button size="icon" className="rounded-full shadow-lg h-10 w-10 relative" onClick={handleScrollToBottom}>
                                <ArrowDown className="h-5 w-5" />
                                {initialUnreadCount && initialUnreadCount > 0 && (
                                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                                        {initialUnreadCount > 9 ? "9+" : initialUnreadCount}
                                    </Badge>
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Scroll to bottom</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
      </div>
      <div className="p-2 border-t bg-background shrink-0">
        {isChannel && !canPostInChannel ? (
            <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Channel is read-only</AlertTitle>
                <AlertDescription>
                    Only admins can send messages in this channel.
                </AlertDescription>
            </Alert>
        ) : isChatPartnerBlocked ? (
           <Alert variant="destructive">
            <UserX className="h-4 w-4" />
            <AlertTitle>User Blocked</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>You can't send messages to a user you have blocked.</span>
              <Button variant="outline" size="sm" onClick={() => chatPartner && unblockUser(chatPartner.id)}>Unblock</Button>
            </AlertDescription>
          </Alert>
        ) : isDmRestricted ? (
           <Alert>
            <AlertTitle>DM Restriction</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>You cannot send direct messages to this user.</span>
               {existingRequest ? (
                    <Button variant="outline" disabled className="capitalize">
                        Request {existingRequest.status}
                    </Button>
                ) : (
                    <Button onClick={() => setIsRequestDmOpen(true)}>
                        Request to DM
                    </Button>
                )}
            </AlertDescription>
          </Alert>
        ) : isRecording ? (
           <div className="flex items-center w-full gap-2">
                <Button variant="ghost" size="icon" className="text-destructive" onClick={handleCancelRecording}>
                  <Trash2 />
                  <span className="sr-only">Cancel recording</span>
                </Button>
                <div className="flex-1 bg-muted rounded-full h-10 flex items-center px-4 gap-2">
                    <div className="w-2.5 h-2.5 bg-destructive rounded-full animate-pulse"></div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleTogglePauseResume}>
                        {recordingStatus === 'paused' ? <Play className="fill-current" /> : <Pause />}
                        <span className="sr-only">{recordingStatus === 'paused' ? 'Resume' : 'Pause'} recording</span>
                    </Button>
                    <span className="text-sm font-mono text-muted-foreground">{formatRecordingTime(recordingTime)}</span>
                </div>
                <Button size="icon" className="h-10 w-10" onClick={handleStopAndSendRecording}>
                  <Send />
                  <span className="sr-only">Send recording</span>
                </Button>
           </div>
        ) : (
          <div>
            <input
                type="file"
                ref={attachmentInputRef}
                onChange={handleFileSelect}
                className="hidden"
            />
            {replyingTo && (
                <div className="flex items-center justify-between p-2 pl-3 mb-2 rounded-t-md bg-muted text-sm border-b">
                    <div>
                        <p className="font-semibold text-primary">Replying to {replyingTo.profiles.name}</p>
                        <p className="text-muted-foreground truncate max-w-xs">{replyingTo.content || (replyingTo.attachment_metadata?.name || 'Attachment')}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setReplyingTo(null)} className="h-7 w-7"><X className="h-4 w-4"/></Button>
                </div>
            )}
            <div className="relative">
               {toolbarPosition && (
                    <div
                        ref={toolbarRef}
                        className="fixed z-10 bg-background border rounded-md shadow-lg p-1 flex gap-1"
                        style={{
                            top: toolbarPosition.top,
                            left: toolbarPosition.left,
                            transform: 'translateX(-50%)',
                        }}
                    >
                        <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormatting('bold')}><Bold className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormatting('italic')}><Italic className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormatting('strikethrough')}><Strikethrough className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormatting('code')}><Code className="h-4 w-4" /></Button>
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
                className={cn("pr-28 min-h-[40px] max-h-40 resize-none", replyingTo && "rounded-t-none")}
                rows={1}
                value={message}
                onChange={handleMessageChange}
                onKeyDown={(e) => {
                  handleKeyDown(e);
                  if (e.key === 'Enter' && !e.shiftKey && !/Mobi|Android/i.test(navigator.userAgent)) {
                    e.preventDefault();
                    if(message.trim()) handleSendMessage({ content: message });
                  }
                }}
                onSelect={(e: any) => handleTextSelection(e)}
                onBlur={() => { setTimeout(() => { setSelection(null); setToolbarPosition(null); }, 150); }}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                <Popover open={isEmojiOpen} onOpenChange={setIsEmojiOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon"><Smile className="h-5 w-5"/></Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full max-w-sm sm:max-w-sm p-0 border-none mb-2" side="top" align="end">
                        
                        <Tabs defaultValue="emoji" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="custom-emoji">
                                    <ImageIcon className="mr-2 h-4 w-4" />
                                    Official
                                </TabsTrigger>
                                <TabsTrigger value="emoji">
                                    <Smile className="mr-2 h-4 w-4" />
                                    Emojis
                                </TabsTrigger>
                                <TabsTrigger value="stickers">
                                    <StickyNote className="mr-2 h-4 w-4" />
                                    Stickers
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value="custom-emoji">
                                <ScrollArea className="h-[350px]">
                                    <p className="text-xs font-semibold text-muted-foreground mb-2 p-4 pb-2">OFFICIAL EMOJIS</p>
                                    <div className="grid grid-cols-5 gap-2 p-4 pt-0">
                                      {customEmojiList.map((emoji) => (
                                        <button
                                          key={emoji}
                                          onClick={() => handleCustomEmojiMessage(emoji)}
                                          className="rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring p-1"
                                          title={`Add ${emoji.split('/').pop()?.split('.')[0]} emoji`}
                                        >
                                          <Image src={emoji} alt="custom emoji" width={40} height={40} className="object-contain" />
                                        </button>
                                      ))}
                                      {customEmojiList.length === 0 && <p className="text-sm text-muted-foreground col-span-5 text-center py-4">No custom emojis found.</p>}
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                            <TabsContent value="emoji">
                                <EmojiPicker 
                                    onEmojiClick={handleEmojiClick}
                                    height={350}
                                    width="100%"
                                    defaultSkinTone={SkinTones.NEUTRAL}
                                />
                            </TabsContent>
                            <TabsContent value="stickers">
                                <ScrollArea className="h-[350px]">
                                    <div className="grid grid-cols-3 gap-2 p-4">
                                    {stickerList.map((sticker) => (
                                        <button
                                            key={sticker}
                                            onClick={() => {
                                                handleSendSticker(sticker);
                                                setIsEmojiOpen(false);
                                            }}
                                            className="rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                                        >
                                            <Image src={sticker} alt="Sticker" width={100} height={100} className="object-contain" />
                                        </button>
                                    ))}
                                    {stickerList.length === 0 && <p className="text-sm text-muted-foreground col-span-3 text-center py-4">No stickers found.</p>}
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </PopoverContent>
                </Popover>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleAttachmentClick}><Paperclip className="h-5 w-5"/></Button>
                    </TooltipTrigger>
                    <TooltipContent>Attach file</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleStartRecording}><Mic className="h-5 w-5"/></Button>
                    </TooltipTrigger>
                    <TooltipContent>Voice message</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button size="icon" className="ml-2 h-8 w-8" onClick={() => handleSendMessage({ content: message })} disabled={isSending || !message.trim()}>
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
