-- Add 'slide' as a first-class content type: simple slide-deck presentations
-- (question-type "slide", played via SlidePresentationSession) get their own
-- "Mes Slides" list, distinct from 'course' (modules/lessons courses).
alter table public.folders drop constraint folders_type_check;
alter table public.folders add constraint folders_type_check
  check (type in ('quiz','poll','flashcard','exam','course','slide'));

alter table public.content drop constraint content_type_check;
alter table public.content add constraint content_type_check
  check (type in ('quiz','poll','flashcard','exam','course','slide'));
