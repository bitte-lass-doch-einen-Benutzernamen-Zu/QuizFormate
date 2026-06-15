alter table public.morph_generations
add column in_quiz boolean not null default false,
add column quiz_position integer
check (quiz_position is null or quiz_position >= 0);

create index morph_generations_quiz_idx
on public.morph_generations (owner_id, in_quiz, quiz_position);

create policy "Admins can update their morph quiz"
on public.morph_generations for update
to authenticated
using (
  owner_id = (select auth.uid())
  and public.is_admin()
)
with check (
  owner_id = (select auth.uid())
  and public.is_admin()
);

grant update (in_quiz, quiz_position)
on public.morph_generations
to authenticated;
