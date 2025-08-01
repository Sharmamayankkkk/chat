-- This function toggles a reaction on a message for a specific user.
-- It inserts or removes the user's ID from the corresponding emoji's array in the message's `reactions` JSONB column.
DROP FUNCTION IF EXISTS public.toggle_reaction(p_emoji text, p_message_id bigint, p_user_id uuid);
CREATE OR REPLACE FUNCTION public.toggle_reaction(p_emoji text, p_message_id bigint, p_user_id uuid)
RETURNS void AS $$
DECLARE
    reaction_users uuid[];
BEGIN
    -- Get the array of users for the given emoji, or an empty array if it doesn't exist
    SELECT COALESCE(reactions->p_emoji, '[]'::jsonb)::jsonb->>0 INTO reaction_users
    FROM messages
    WHERE id = p_message_id;

    -- Check if the user has already reacted with this emoji
    IF p_user_id = ANY(reaction_users) THEN
        -- User has reacted, so remove their ID
        UPDATE messages
        SET reactions = jsonb_set(
            reactions,
            ARRAY[p_emoji],
            to_jsonb(array_remove(reaction_users, p_user_id))
        )
        WHERE id = p_message_id;

        -- If the emoji array is now empty, remove the key
        UPDATE messages
        SET reactions = reactions - p_emoji
        WHERE id = p_message_id AND jsonb_array_length(reactions->p_emoji) = 0;
    ELSE
        -- User has not reacted, so add their ID
        UPDATE messages
        SET reactions = jsonb_set(
            COALESCE(reactions, '{}'::jsonb),
            ARRAY[p_emoji],
            to_jsonb(COALESCE(reaction_users, '{}'::uuid[]) || ARRAY[p_user_id])
        )
        WHERE id = p_message_id;
    END IF;
END;
$$ LANGUAGE plpgsql;


-- This function marks all messages in a given chat as read by a specific user.
-- It adds the user's ID to the `read_by` array for any message they haven't read yet.
DROP FUNCTION IF EXISTS public.mark_messages_as_read(p_chat_id bigint, p_user_id uuid);
CREATE OR REPLACE FUNCTION public.mark_messages_as_read(p_chat_id bigint, p_user_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE messages
    SET read_by = array_append(read_by, p_user_id)
    WHERE chat_id = p_chat_id
      AND NOT (read_by @> ARRAY[p_user_id]);
END;
$$ LANGUAGE plpgsql;


-- This function efficiently fetches the last message for a given list of chat IDs.
-- It's used to populate the chat list in the sidebar with the latest message preview.
DROP FUNCTION IF EXISTS public.get_last_messages_for_chats(p_chat_ids bigint[]);
CREATE OR REPLACE FUNCTION public.get_last_messages_for_chats(p_chat_ids bigint[])
RETURNS TABLE(chat_id bigint, content text, attachment_metadata jsonb, created_at timestamp with time zone) AS $$
BEGIN
    RETURN QUERY
    WITH ranked_messages AS (
        SELECT
            m.chat_id,
            m.content,
            m.attachment_metadata,
            m.created_at,
            ROW_NUMBER() OVER(PARTITION BY m.chat_id ORDER BY m.created_at DESC) as rn
        FROM
            messages m
        WHERE
            m.chat_id = ANY(p_chat_ids)
    )
    SELECT
        rm.chat_id,
        rm.content,
        rm.attachment_metadata,
        rm.created_at
    FROM
        ranked_messages rm
    WHERE
        rm.rn = 1;
END;
$$ LANGUAGE plpgsql;
