alter table public.morph_generations
add column difficulty text not null default 'medium'
check (difficulty in ('easy', 'medium', 'hard'));
