import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as repo from './adminRepo';
import type { Status, ReportStatus } from './types';

// Map a content table to the public query key it feeds, so admin edits refresh public pages.
const PUBLIC_KEY: Record<string, string> = {
  roadmap_items: 'roadmap', changelog_releases: 'changelog', changelog_items: 'changelog',
  guides: 'guides', faq_items: 'faq', reviews: 'reviews',
};

function useContentList<T>(key: string, fetcher: () => Promise<T[]>) {
  return useQuery({ queryKey: ['admin', key], queryFn: fetcher });
}

export const useAdminRoadmap = () => useContentList(['roadmap_items'].join(), repo.listRoadmap);
export const useAdminGuides = () => useContentList(['guides'].join(), repo.listGuides);
export const useAdminFaq = () => useContentList(['faq_items'].join(), repo.listFaq);
export const useAdminReleases = () => useContentList(['changelog_releases'].join(), repo.listReleases);

export function useContentMutations(table: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', table] });
    const pub = PUBLIC_KEY[table];
    if (pub) qc.invalidateQueries({ queryKey: ['pages', pub] });
  };
  return {
    create: useMutation({ mutationFn: (v: Record<string, unknown>) => repo.createRow(table, v), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) => repo.updateRow(table, id, patch), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => repo.deleteRow(table, id), onSuccess: invalidate }),
    setStatus: useMutation({ mutationFn: ({ id, status }: { id: string; status: Status }) => repo.setStatus(table, id, status), onSuccess: invalidate }),
  };
}

export const useReleaseItems = (releaseId: string) =>
  useQuery({ queryKey: ['admin', 'changelog_items', releaseId], queryFn: () => repo.listReleaseItems(releaseId), enabled: !!releaseId });

// Moderation
export function useModerationReviews() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['admin', 'reviews'], queryFn: () => repo.listReviews('pending') });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'published' | 'rejected' }) => repo.setReviewStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'reviews'] }); qc.invalidateQueries({ queryKey: ['pages', 'reviews'] }); },
  });
  return { list, setStatus };
}

export function useModerationIdeas() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['admin', 'ideas'], queryFn: () => repo.listIdeas('pending') });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['admin', 'ideas'] }); qc.invalidateQueries({ queryKey: ['admin', 'roadmap_items'] }); qc.invalidateQueries({ queryKey: ['pages', 'roadmap'] }); };
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: 'converted' | 'rejected' }) => repo.setIdeaStatus(id, status), onSuccess: invalidate });
  const convert = useMutation({ mutationFn: ({ ideaId, input }: { ideaId: string; input: { col: string; category: string; title: string; subtitle: string } }) => repo.convertIdeaToRoadmap(ideaId, input), onSuccess: invalidate });
  return { list, setStatus, convert };
}

export function useModerationReports() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['admin', 'reports'], queryFn: () => repo.listReports() });
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: ReportStatus }) => repo.setReportStatus(id, status), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'reports'] }) });
  return { list, setStatus };
}

export const useSubscribers = () => useQuery({ queryKey: ['admin', 'subscribers'], queryFn: repo.listSubscribers });

// Published reviews — the testimonials shown on /reviews, curated in public form.
export const useAdminReviews = () =>
  useQuery({ queryKey: ['admin', 'reviews', 'published'], queryFn: () => repo.listReviewsFull('published') });
