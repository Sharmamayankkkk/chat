
'use client';

// This is the main component that orchestrates the entire chat view.
// We've broken it down into smaller, more manageable pieces to keep the code clean.
// Think of this component as the "manager" that brings together the header, the message list, and the input field.

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSwipeable } from 'react-swipeable';
import { MoreVertical, Phone, Video, Check, CheckCheck, Pencil, Trash2, SmilePlus, X, FileIcon, Download, Copy, Star, Share2, Shield, Loader2, Pause, Play, Users, UserX, ShieldAlert, Pin, PinOff, Reply, Clock, CircleSlash, ArrowDown, AtSign, Info, Languages } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Chat, User, Message, AttachmentMetadata } from '@/lib/types';
import { cn, getContrastingTextColor, createClient } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAppContext } from '@/providers/app-provider';
import EmojiPicker, { EmojiClickData, SkinTones } from 'emoji-picker-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { VoiceNotePlayer } from './voice-note-player';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import { RequestDmDialog } from './request-dm-dialog';
import { Badge } from '@/components/ui/badge';
import { ForwardMessageDialog } from './forward-message-dialog';
import { ReportDialog } from './report-dialog';
import { PinnedMessagesDialog } from './pinned-messages-dialog';
import { LinkPreview } from './link-preview';
import { ImageViewerDialog } from './image-viewer';
import { MessageInfoDialog } from './message-info-dialog';
import { ChatInput } from './chat-input';
import { TranslateDialog } from './translate-dialog';
import { VideoCallInterface } from './video-call-interface';
import { IncomingCallNotification } from './incoming-call-notification';
import type { CallSession, CallParticipant } from '@/lib/types';


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

const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

const DELETED_MESSAGE_MARKER = '[[MSG_DELETED]]';
const SYSTEM_MESSAGE_PREFIX = '[[SYS:';

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
    // This is a "hook" from a small library we use for showing pop-up notifications (like "Message copied!").
    const { toast } = useToast();
    
    // This is our custom "hook" to access shared application data and functions,
    // like the theme settings, the list of all users, and functions to block a user or leave a group.
    const { 
        themeSettings, 
        allUsers, 
        dmRequests, 
        leaveGroup,
        deleteGroup,
        sendDmRequest,
        unblockUser,
        blockedUsers,
        forwardMessage,
    } = useAppContext();

    // These are "state" variables. They hold data that can change and cause the component to re-render.
    // `useState` is a fundamental React hook for managing component state.
    const [editingMessage, setEditingMessage] = useState<{ id: number; content: string } | null>(null);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [isRequestDmOpen, setIsRequestDmOpen] = useState(false);
    const [messageToTranslate, setMessageToTranslate] = useState<Message | null>(null);
    
    // `useRef` is a React hook that lets us hold a reference to a DOM element,
    // like a div, so we can interact with it directly (e.g., to scroll it).
    // It's like `document.getElementById` but integrated with React.
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const [customEmojiList, setCustomEmojiList] = useState<string[]>([]);
    
    const [messageToForward, setMessageToForward] = useState<Message | null>(null);

    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
    const [messageToReport, setMessageToReport] = useState<Message | null>(null);

    const [isPinnedDialogOpen, setIsPinnedDialogOpen] = useState(false);
    
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const [firstUnreadMentionId, setFirstUnreadMentionId] = useState<number | null>(null);
    
    const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
    const [imageViewerSrc, setImageViewerSrc] = useState('');
    
    const [messageInfo, setMessageInfo] = useState<Message | null>(null);
    
    const hasScrolledOnLoad = useRef(false);
    
    // Call-related state
    const [activeCall, setActiveCall] = useState<CallSession | null>(null);
    const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
    const [callParticipants, setCallParticipants] = useState<CallParticipant[]>([]);
    const supabase = createClient();

    // The `useEffect` hook runs code after the component has rendered.
    // This one sets up a scroll listener to show or hide the "scroll to bottom" button.
    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer) return;

        const handleScroll = () => {
            const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 400;
            setShowScrollToBottom(!isAtBottom);
        };

        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        // The return function is a "cleanup" function. React runs it when the component is removed
        // to prevent memory leaks, like removing the event listener.
        return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }, [scrollContainerRef]);

    // This effect checks for the first unread mention and stores its ID.
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

    // This effect fetches our custom emoji and sticker assets from the server when the component loads.
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
                setCustomEmojiList(data.emojis || []);
            })
            .catch(err => console.error("Failed to load assets:", err));
    }, []);
    
    // Subscribe to incoming calls
    useEffect(() => {
        if (!chat.id || !loggedInUser.id) return;

        const channel = supabase
            .channel(`call-notifications-${chat.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'call_sessions',
                    filter: `chat_id=eq.${chat.id}`,
                },
                async (payload) => {
                    const session = payload.new as CallSession;
                    
                    // Don't show notification if we initiated the call
                    if (session.initiated_by === loggedInUser.id) return;
                    
                    // Fetch caller info
                    const { data: caller } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.initiated_by)
                        .single();
                    
                    if (caller) {
                        setIncomingCall({ ...session, initiator: caller });
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'call_sessions',
                    filter: `chat_id=eq.${chat.id}`,
                },
                (payload) => {
                    const session = payload.new as CallSession;
                    
                    // Clear incoming call if it's ended or rejected
                    if (session.status === 'ended' || session.status === 'rejected') {
                        setIncomingCall(null);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [chat.id, loggedInUser.id, supabase]);

    // Handle call initiation
    const handleStartCall = useCallback(async (callType: 'audio' | 'video') => {
        try {
            // Check if group call - only admins can start
            if (isGroup && !isGroupAdmin) {
                toast({
                    title: "Permission Denied",
                    description: "Only group admins can start calls",
                    variant: "destructive",
                });
                return;
            }

            const { data: session, error } = await supabase
                .from('call_sessions')
                .insert({
                    chat_id: chat.id,
                    initiated_by: loggedInUser.id,
                    call_type: callType,
                    status: 'ringing',
                })
                .select()
                .single();

            if (error) throw error;

            // Fetch participants
            const { data: participants } = await supabase
                .from('call_participants')
                .select('*, profiles(*)')
                .eq('call_id', session.id);

            setActiveCall(session);
            setCallParticipants(participants || []);
        } catch (error) {
            console.error('Error starting call:', error);
            toast({
                title: "Error",
                description: "Failed to start call",
                variant: "destructive",
            });
        }
    }, [chat.id, loggedInUser.id, isGroup, isGroupAdmin, supabase, toast]);

    // Handle accepting incoming call
    const handleAcceptCall = useCallback(async () => {
        if (!incomingCall) return;

        // Fetch participants
        const { data: participants } = await supabase
            .from('call_participants')
            .select('*, profiles(*)')
            .eq('call_id', incomingCall.id);

        setActiveCall(incomingCall);
        setCallParticipants(participants || []);
        setIncomingCall(null);
    }, [incomingCall, supabase]);

    // Handle rejecting incoming call
    const handleRejectCall = useCallback(async () => {
        if (!incomingCall) return;

        await supabase
            .from('call_sessions')
            .update({ status: 'rejected' })
            .eq('id', incomingCall.id);

        setIncomingCall(null);
    }, [incomingCall, supabase]);

    // Handle ending active call
    const handleEndCall = useCallback(async () => {
        if (!activeCall) return;

        await supabase
            .from('call_sessions')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('id', activeCall.id);

        setActiveCall(null);
        setCallParticipants([]);
    }, [activeCall, supabase]);
            })
            .catch(err => console.error("Failed to load assets:", err));
    }, []);

    // `useMemo` is a performance optimization hook. It calculates a value and "memoizes" (remembers) it.
    // The value is only recalculated if one of the dependencies (the array at the end) changes.
    // This prevents expensive calculations on every single render.
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

    // `useCallback` is another performance hook, similar to `useMemo`.
    // It memoizes a function, so it isn't recreated on every render.
    // This is important when passing functions down to child components to prevent unnecessary re-renders.
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

    // This effect handles scrolling when the chat loads.
    // It tries to scroll to a highlighted message if there is one, otherwise it scrolls to the bottom.
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
    
    // This effect smoothly scrolls to the bottom when new messages are added,
    // but only if the user is already near the bottom. This prevents auto-scrolling
    // when the user is reading older messages.
    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer) return;
    
        const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 200;
        if (isNearBottom) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chat.messages?.length, scrollContainerRef]);

    // This function handles saving an edited message.
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

    // This function handles deleting a message for everyone in the chat.
    // It first updates the UI optimistically (shows it as deleted immediately)
    // and then makes the actual request to the server.
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
            // If the server request fails, we revert the UI back to its original state.
            toast({ variant: 'destructive', title: "Error deleting message", description: error.message });
            setMessages(originalMessages);
        }
    };
    
    // Simple utility function to copy text to the clipboard.
    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: 'Copied to clipboard' });
    };

    // Functions to set the component's state for editing or replying to a message.
    const handleStartEdit = (message: Message) => {
        setReplyingTo(null);
        setEditingMessage({ id: message.id as number, content: message.content || '' });
    };

    const handleStartReply = (message: Message) => {
        setEditingMessage(null);
        setReplyingTo(message);
    };

    // This function handles adding or removing a reaction from a message.
    // It calls a custom database function (RPC) on Supabase to handle the logic.
    const handleReaction = async (message: Message, emoji: string) => {
        if (typeof message.id === 'string') {
             toast({ variant: 'destructive', title: 'Cannot react yet', description: 'Please wait for the message to be sent.' });
             return;
        }
        const { error } = await supabase.rpc('toggle_reaction', { 
            p_emoji: emoji, 
            p_message_id: message.id, 
            p_user_id: loggedInUser.id,
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

    // A function to send a special "system" message, like "User pinned a message".
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

    // Functions to toggle the "starred" or "pinned" state of a message.
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

    // Functions to scroll to the bottom of the chat or to the first unread mention.
    const handleScrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleJumpToMention = () => {
        if (firstUnreadMentionId) {
            jumpToMessage(firstUnreadMentionId);
            setFirstUnreadMentionId(null);
        }
    };

    // These are dynamic styles based on the user's theme settings.
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

    // Determines the status of a message (pending, sent, or read).
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
    
    // This function is the heart of our message rendering. It parses the message content
    // for special formatting like mentions, custom emojis, and links, and replaces them
    // with the appropriate React components.
    const parseContent = useCallback((content: string | null): (string | React.ReactNode)[] => {
        if (!content) return [];

        let processedContent = content;

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

    // This function determines how to display a message based on its content,
    // especially whether it's a text message or an attachment (image, file, event).
    const renderMessageContent = (message: Message) => {
        const mainContent = message.content;
        
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
                    return <VoiceNotePlayer src={message.attachment_url!} isMyMessage={message.user_id === loggedInUser.id} metadata={message.attachment_metadata} />;
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
            
            const showCaption = mainContent && !type.startsWith('audio/') && !isSticker;

            return (
                <div className="space-y-2 break-words min-w-0">
                    {attachmentElement()}
                    {showCaption && <p className="whitespace-pre-wrap break-words">{parseContent(mainContent)}</p>}
                </div>
            );
        }
        return <p className="whitespace-pre-wrap break-words">{parseContent(mainContent)}</p>;
    }
    
    // Prepares custom emojis for the reaction picker.
    const reactionPickerCustomEmojis = useMemo(() => {
        return customEmojiList.map(url => ({
            id: url,
            names: [url.split('/').pop()?.split('.')[0] || 'custom'],
            img: url,
        }));
    }, [customEmojiList]);

    // Renders the little reaction buttons below a message.
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

    // This function processes the list of messages to insert date separators ("Today", "Yesterday")
    // and an "Unread Messages" separator where needed.
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

    // Simple components for rendering the separators in the message list.
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
  
  // This is the component for a single message bubble.
  const MessageBubble = ({ message }: { message: Message }) => {
    // Handle system messages (e.g., "User pinned a message").
    if (message.content && message.content.startsWith(SYSTEM_MESSAGE_PREFIX)) {
        return <SystemMessage content={message.content} />;
    }
    
    // Handle deleted messages.
    if (message.content === DELETED_MESSAGE_MARKER) {
        const isMyMessage = message.user_id === loggedInUser.id;
        const bubbleStyle = isMyMessage ? outgoingBubbleStyle : incomingBubbleStyle;
        return (
            <div className={cn("flex items-end gap-2 group/message", isMyMessage ? "justify-end" : "justify-start")}>
                 {!isMyMessage && <div className="w-8 shrink-0" />}
                 <div
                    className="relative max-w-[85%] sm:max-w-md lg:max-w-lg rounded-lg text-sm px-2 sm:px-3 py-2"
                    style={bubbleStyle}
                 >
                    <div className="flex items-center gap-2 italic text-current/70">
                        <CircleSlash className="h-4 w-4" />
                        <span>This message was deleted</span>
                    </div>
                </div>
                 {isMyMessage && <div className="w-8 shrink-0" />}
            </div>
        );
    }

    const isMyMessage = message.user_id === loggedInUser.id;
    const sender = message.profiles;
    const isEditing = editingMessage?.id === message.id;
    const messageStatus = getMessageStatus(message);
    const isOptimistic = typeof message.id === 'string';

    // This adds the "swipe to reply" functionality.
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
          "flex w-full items-end gap-2 group/message",
          isMyMessage ? "justify-end" : "justify-start",
          message.id === highlightMessageId && "rounded-lg"
      )}>
      {!isMyMessage && (
          <Avatar className="h-8 w-8 self-end shrink-0">
          <AvatarImage src={senderAvatar} alt={senderName} data-ai-hint="avatar" />
          <AvatarFallback>{senderFallback}</AvatarFallback>
          </Avatar>
      )}
      <div {...swipeHandlers} className={cn("relative transition-transform duration-200 ease-out min-w-0", isMyMessage ? "group-data-[swiped=true]/message:translate-x-[-2rem]" : "group-data-[swiped=true]/message:translate-x-[2rem]")}>
          <div 
              className={cn("group/bubble relative rounded-lg text-sm px-2 sm:px-3 py-2 break-words max-w-[80vw] sm:max-w-md md:max-w-lg")}
              style={bubbleStyle}
          >
              {isEditing ? (
                  <div className="w-full">
                      <p className="text-xs font-semibold text-primary mb-2">Editing...</p>
                      {/* The ChatInput component handles the actual editing input field */}
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
              
              {/* This is the message action menu that appears on hover */}
              {!isEditing && (
                  <div className={cn(
                      "absolute -top-4 flex items-center gap-1 opacity-0 group-hover/bubble:opacity-100 transition-opacity",
                      isMyMessage ? "left-[-8px]" : "right-[-8px]"
                  )}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-background/80 hover:bg-background">
                                  <MoreVertical className="h-4 w-4" />
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-auto p-1">
                              <DropdownMenuItem onClick={() => handleStartReply(message)} disabled={isOptimistic}>
                                <Reply className="mr-2 h-4 w-4" />
                                <span>Reply</span>
                              </DropdownMenuItem>
                              {message.content && !isMyMessage && (
                                <DropdownMenuItem onClick={() => setMessageToTranslate(message)}>
                                    <Languages className="mr-2 h-4 w-4" />
                                    <span>Translate</span>
                                </DropdownMenuItem>
                              )}
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
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-background/80 hover:bg-background" onClick={() => handleStartReply(message)} disabled={isOptimistic}>
                          <Reply className="h-4 w-4" />
                      </Button>
                  </div>
              )}
              {renderReactions(message)}
          </div>
        </div>
      {isMyMessage && (
          <Avatar className="h-8 w-8 self-end shrink-0">
              <AvatarImage src={loggedInUser.avatar_url} alt={loggedInUser.name} data-ai-hint="avatar" />
              <AvatarFallback>{loggedInUser.name?.charAt(0)}</AvatarFallback>
          </Avatar>
      )}
      </div>
    );
  }

  // This is the main return statement for the Chat component.
  // It lays out the entire chat interface, using all the pieces and logic defined above.
  return (
    <div className="flex h-dvh flex-col">
        {/* These are Dialog components. They are modals that pop up over the screen. */}
        <TranslateDialog open={!!messageToTranslate} onOpenChange={() => setMessageToTranslate(null)} message={messageToTranslate} />
        <ImageViewerDialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen} src={imageViewerSrc} />
        {chatPartner && <RequestDmDialog open={isRequestDmOpen} onOpenChange={setIsRequestDmOpen} targetUser={chatPartner} />}
        {messageToForward && <ForwardMessageDialog open={!!messageToForward} onOpenChange={(open) => !open && setMessageToForward(null)} message={messageToForward} />}
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

      {/* This is the header of the chat window. */}
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
            <Button variant="ghost" size="icon" onClick={() => handleStartCall('audio')}><Phone className="h-5 w-5"/></Button>
            <Button variant="ghost" size="icon" onClick={() => handleStartCall('video')}><Video className="h-5 w-5"/></Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <MoreVertical />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild><Link href={isGroup ? `/group/${chat.id}` : `/profile/${chatPartner?.username || ''}`}>View Info</Link></DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>Clear chat</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </header>
      
      {/* This is the main message area. */}
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
                    // This makes sure we don't show messages from users the current user has blocked.
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
                {/* This is an invisible div at the end of the message list that we use as a target to scroll to. */}
                <div ref={messagesEndRef} />
            </div>
        </ScrollArea>
        {/* These are the floating buttons for scrolling down or jumping to a mention. */}
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
        {/* This is our newly created ChatInput component. */}
        <ChatInput
            chat={chat}
            loggedInUser={loggedInUser}
            setMessages={setMessages}
            replyingTo={replyingTo}
            setReplyingTo={setReplyingTo}
            editingMessage={editingMessage}
            setEditingMessage={setEditingMessage}
            onSaveEdit={handleSaveEdit}
            messagesEndRef={messagesEndRef}
            isChannel={isChannel}
            canPostInChannel={canPostInChannel}
            isChatPartnerBlocked={isChatPartnerBlocked}
            isDmRestricted={isDmRestricted}
            existingRequest={existingRequest}
            onUnblockUser={() => chatPartner && unblockUser(chatPartner.id)}
            onRequestDm={() => setIsRequestDmOpen(true)}
        />
        
        {/* Incoming call notification */}
        {incomingCall && incomingCall.initiator && (
            <IncomingCallNotification
                callSession={incomingCall}
                caller={incomingCall.initiator}
                callType={incomingCall.call_type}
                onAccept={handleAcceptCall}
                onReject={handleRejectCall}
            />
        )}
        
        {/* Active call interface */}
        {activeCall && (
            <VideoCallInterface
                callId={activeCall.id}
                chatId={chat.id}
                callType={activeCall.call_type}
                participants={callParticipants}
                loggedInUser={loggedInUser}
                isGroupCall={isGroup}
                isAdmin={isGroupAdmin || false}
                onEndCall={handleEndCall}
            />
        )}
    </div>
  );
}
