
'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useAppContext } from "@/providers/app-provider"
import type { Event } from '@/lib/types'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn, createClient } from '@/lib/utils'
import { format } from 'date-fns'
import { CalendarIcon, Upload, Loader2 } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import Image from 'next/image'
import { v4 as uuidv4 } from 'uuid';

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventToEdit?: Event;
  onEventCreated: () => void;
  onEventUpdated: () => void;
}

const createEventSchema = z.object({
  title: z.string().min(3, "Event title must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters long."),
  meet_link: z.string().url("Please provide a valid URL.").optional().or(z.literal('')),
  date: z.date({ required_error: "A date is required." }),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Please enter a valid time in HH:mm format."),
});

export function CreateEventDialog({ open, onOpenChange, eventToEdit, onEventCreated, onEventUpdated }: CreateEventDialogProps) {
  const { toast } = useToast();
  const { loggedInUser } = useAppContext();
  
  const [thumbnailFile, setThumbnailFile] = React.useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = React.useState<string | null>(eventToEdit?.thumbnail || null);
  const [isLoading, setIsLoading] = React.useState(false);

  const thumbnailInputRef = React.useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const isEditing = !!eventToEdit;

  const form = useForm<z.infer<typeof createEventSchema>>({
    resolver: zodResolver(createEventSchema),
    defaultValues: isEditing ? {
      title: eventToEdit.title,
      description: eventToEdit.description || '',
      meet_link: eventToEdit.meet_link || '',
      date: new Date(eventToEdit.date_time),
      time: format(new Date(eventToEdit.date_time), "HH:mm"),
    } : {
      title: '',
      description: '',
      meet_link: '',
      time: '18:00',
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset(isEditing ? {
        title: eventToEdit.title,
        description: eventToEdit.description || '',
        meet_link: eventToEdit.meet_link || '',
        date: new Date(eventToEdit.date_time),
        time: format(new Date(eventToEdit.date_time), "HH:mm"),
      } : {
        title: '',
        description: '',
        meet_link: '',
        date: undefined,
        time: '18:00',
      });
      setThumbnailPreview(eventToEdit?.thumbnail || null);
      setThumbnailFile(null);
    }
  }, [open, form, isEditing, eventToEdit]);

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (values: z.infer<typeof createEventSchema>) => {
    if (!loggedInUser) return;
    setIsLoading(true);

    try {
      let thumbnailUrl = eventToEdit?.thumbnail || '';
      if (thumbnailFile) {
        const fileExt = thumbnailFile.name.split('.').pop();
        const filePath = `public/event_thumbnails/${uuidv4()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, thumbnailFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(filePath);
        thumbnailUrl = urlData.publicUrl;
      }
      
      const [hours, minutes] = values.time.split(':').map(Number);
      const combinedDateTime = new Date(values.date);
      combinedDateTime.setHours(hours, minutes);

      if (isEditing) {
        const { error } = await supabase.from('events').update({
          title: values.title,
          description: values.description,
          thumbnail: thumbnailUrl,
          meet_link: values.meet_link,
          date_time: combinedDateTime.toISOString(),
        }).eq('id', eventToEdit.id);

        if (error) throw error;
        toast({ title: "Event Updated!", description: `The event "${values.title}" has been updated.` });
        onEventUpdated();
      } else {
        const { error } = await supabase.from('events').insert({
          creator_id: loggedInUser.id,
          title: values.title,
          description: values.description,
          thumbnail: thumbnailUrl,
          meet_link: values.meet_link,
          date_time: combinedDateTime.toISOString(),
        });
        if (error) throw error;
        toast({ title: "Event Created!", description: `The event "${values.title}" has been scheduled.` });
        onEventCreated();
      }
      
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error saving event', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Event' : 'Create a New Event'}</DialogTitle>
          <DialogDescription>
            Fill out the details below to {isEditing ? 'update this event' : 'schedule a new event for the community'}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto pr-4">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Title</FormLabel>
                    <FormControl><Input placeholder="E.g., Bhagavad Gita Study" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea placeholder="What is this event about?" className="resize-none" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Thumbnail</FormLabel>
                  <div className="flex items-center gap-4">
                    <div className="relative w-48 h-27 aspect-video rounded-md overflow-hidden bg-muted">
                        {thumbnailPreview ? <Image src={thumbnailPreview} alt="thumbnail preview" fill className="object-cover" /> : <div className="h-full w-full bg-muted"/>}
                    </div>
                    <Button type="button" variant="outline" onClick={() => thumbnailInputRef.current?.click()}>
                        <Upload className="mr-2 h-4 w-4"/>
                        Upload Image
                    </Button>
                    <input type="file" ref={thumbnailInputRef} onChange={handleThumbnailChange} className="hidden" accept="image/*" />
                  </div>
                <FormMessage />
              </FormItem>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) } initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
               <FormField
                  control={form.control}
                  name="meet_link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Google Meet Link (Optional)</FormLabel>
                      <FormControl><Input placeholder="https://meet.krishnaconsciousnesssociety.com/..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            <DialogFooter className="sticky bottom-0 bg-background py-4">
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Create Event'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
