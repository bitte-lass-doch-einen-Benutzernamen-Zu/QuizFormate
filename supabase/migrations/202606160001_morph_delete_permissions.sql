create policy "Admins can delete their morph generations"
on public.morph_generations for delete
to authenticated
using (
  owner_id = (select auth.uid())
  and public.is_admin()
);

create policy "Admins can delete generated morph images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'morph-images'
  and public.is_admin()
);

grant delete
on public.morph_generations
to authenticated;
