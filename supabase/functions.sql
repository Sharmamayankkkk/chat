-- This function safely toggles a reaction on a message.
-- It handles adding/removing users from a reaction, adding new reactions,
-- and cleaning up empty reactions.
-- It's defined as 'plpgsql' language for procedural logic.
-- It is "SECURITY DEFINER" to run with the permissions of the user who defined it,
-- allowing it to bypass RLS policies temporarily for this specific operation.
-- This is safe because the function's logic is self-contained and only modifies reactions.

DROP FUNCTION IF EXISTS public.toggle_reaction(p_emoji text, p_message_id bigint, p_user_id uuid);

CREATE OR REPLACE FUNCTION public.toggle_reaction(p_emoji text, p_message_id bigint, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_reactions jsonb;
  emoji_reactors jsonb;
  user_id_text text := p_user_id::text;
BEGIN
  -- 1. Get the current reactions for the message
  SELECT reactions INTO current_reactions FROM public.messages WHERE id = p_message_id;

  -- Initialize reactions if null
  IF current_reactions IS NULL THEN
    current_reactions := '{}'::jsonb;
  END IF;

  -- 2. Check if the emoji already exists in the reactions
  IF current_reactions ? p_emoji THEN
    -- Emoji exists, get the list of users who reacted with it
    emoji_reactors := current_reactions -> p_emoji;

    -- 3. Check if the user has already reacted with this emoji
    IF emoji_reactors ? user_id_text THEN
      -- User has reacted, so remove them from the list
      emoji_reactors := emoji_reactors - user_id_text;
    ELSE
      -- User has not reacted, so add them to the list
      emoji_reactors := emoji_reactors || to_jsonb(user_id_text);
    END IF;

    -- 4. If the list of reactors for this emoji is now empty, remove the emoji
    IF jsonb_array_length(emoji_reactors) = 0 THEN
      current_reactions := current_reactions - p_emoji;
    ELSE
      current_reactions := jsonb_set(current_reactions, ARRAY[p_emoji], emoji_reactors);
    END IF;

  ELSE
    -- 5. Emoji does not exist, so add it with the current user as the first reactor
    current_reactions := current_reactions || jsonb_build_object(p_emoji, jsonb_build_array(user_id_text));
  END IF;

  -- 6. Update the message with the new reactions
  UPDATE public.messages
  SET reactions = current_reactions
  WHERE id = p_message_id;

END;
$$;


-- This function marks all messages in a given chat as read by a specific user.
-- It uses the 'read_by' array in the messages table and appends the user's ID
-- only if it's not already present, preventing duplicates.
-- It is also "SECURITY DEFINER" to safely bypass RLS for this specific update.

DROP FUNCTION IF EXISTS public.mark_messages_as_read(p_chat_id bigint, p_user_id uuid);

CREATE OR REPLACE FUNCTION public.mark_messages_as_read(p_chat_id bigint, p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.messages
  SET read_by = array_append(read_by, p_user_id)
  WHERE
    chat_id = p_chat_id AND
    NOT (read_by @> ARRAY[p_user_id]);
$$;


-- This function efficiently retrieves the last message for a list of chat IDs.
-- It's used to populate the chat list in the sidebar with message previews.
-- It uses a window function `ROW_NUMBER()` to partition messages by chat_id
-- and order them by creation date to find the most recent one for each chat.

DROP FUNCTION IF EXISTS public.get_last_messages_for_chats(p_chat_ids bigint[]);

CREATE OR REPLACE FUNCTION public.get_last_messages_for_chats(p_chat_ids bigint[])
RETURNS TABLE(
  id bigint,
  chat_id bigint,
  user_id uuid,
  content text,
  created_at timestamptz,
  attachment_metadata jsonb
)
LANGUAGE sql
AS $$
  WITH ranked_messages AS (
    SELECT
      m.id,
      m.chat_id,
      m.user_id,
      m.content,
      m.created_at,
      m.attachment_metadata,
      ROW_NUMBER() OVER(PARTITION BY m.chat_id ORDER BY m.created_at DESC) as rn
    FROM
      public.messages m
    WHERE
      m.chat_id = ANY(p_chat_ids)
  )
  SELECT
    rm.id,
    rm.chat_id,
    rm.user_id,
    rm.content,
    rm.created_at,
    rm.attachment_metadata
  FROM
    ranked_messages rm
  WHERE
    rm.rn = 1;
$$;
