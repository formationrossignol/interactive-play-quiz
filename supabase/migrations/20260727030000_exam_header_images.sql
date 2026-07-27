-- Give asynchronous exams their own visual header, mirrored into the generic
-- content document so cards stay aligned with quizzes, polls and courses.

alter table public.exams add column header_image text;
