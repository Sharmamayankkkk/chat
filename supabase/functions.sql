
-- Function to get the last message for a set of chat IDs
create or replace function get_last_messages_for_chats(p_chat_ids bigint[])
returns table (
    chat_id bigint,
    content text,
    attachment_metadata jsonb,
    created_at timestamptz
) as $$
begin
    return query
    with last_messages as (
        select
            m.chat_id,
            m.content,
            m.attachment_metadata,
            m.created_at,
            row_number() over (partition by m.chat_id order by m.created_at desc) as rn
        from messages m
        where m.chat_id = any(p_chat_ids)
    )
    select
        lm.chat_id,
        lm.content,
        lm.attachment_metadata,
        lm.created_at
    from last_messages lm
    where lm.rn = 1;
end;
$$ language plpgsql;


-- Function to mark messages as read for a user in a specific chat
create or replace function mark_messages_as_read(p_chat_id bigint, p_user_id uuid)
returns void as $$
begin
    update messages
    set read_by = array_append(read_by, p_user_id)
    where chat_id = p_chat_id
      and not (read_by @> array[p_user_id]);
end;
$$ language plpgsql;


-- Function to add or remove a reaction from a message
create or replace function toggle_reaction(p_message_id bigint, p_user_id uuid, p_emoji text)
returns void as $$
declare
    current_reactions jsonb;
    user_ids_for_emoji uuid[];
    user_has_reacted boolean;
begin
    -- Get the current reactions for the message
    select reactions into current_reactions from messages where id = p_message_id;

    -- Initialize reactions if it's null
    if current_reactions is null then
        current_reactions := '{}'::jsonb;
    end if;

    -- Check if the emoji already exists in the reactions
    if current_reactions ? p_emoji then
        -- Emoji exists, get the array of user IDs
        user_ids_for_emoji := array(select jsonb_array_elements_text(current_reactions -> p_emoji));
        
        -- Check if the user has already reacted with this emoji
        user_has_reacted := p_user_id = any(user_ids_for_emoji);

        if user_has_reacted then
            -- User has reacted, so remove their ID
            user_ids_for_emoji := array_remove(user_ids_for_emoji, p_user_id);
            if array_length(user_ids_for_emoji, 1) is null then
                 -- If no users are left for this emoji, remove the emoji key
                current_reactions := current_reactions - p_emoji;
            else
                -- Otherwise, update the array for the emoji
                current_reactions := jsonb_set(current_reactions, array[p_emoji], to_jsonb(user_ids_for_emoji));
            end if;
        else
            -- User has not reacted, so add their ID
            user_ids_for_emoji := array_append(user_ids_for_emoji, p_user_id);
            current_reactions := jsonb_set(current_reactions, array[p_emoji], to_jsonb(user_ids_for_emoji));
        end if;
    else
        -- Emoji does not exist, so add it with the user's ID
        current_reactions := jsonb_set(current_reactions, array[p_emoji], to_jsonb(array[p_user_id]));
    end if;

    -- Update the message with the new reactions
    update messages set reactions = current_reactions where id = p_message_id;
end;
$$ language plpgsql;

