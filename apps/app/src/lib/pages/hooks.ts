import { useQuery } from '@tanstack/react-query';
import { fetchRoadmapWithVotes, fetchChangelog, fetchGuides, fetchFaq, fetchReviews, fetchStaticPage } from './repo';

export const useRoadmap = () =>
  useQuery({ queryKey: ['pages', 'roadmap'], queryFn: fetchRoadmapWithVotes });

export const useChangelog = () =>
  useQuery({ queryKey: ['pages', 'changelog'], queryFn: fetchChangelog });

export const useGuides = () =>
  useQuery({ queryKey: ['pages', 'guides'], queryFn: fetchGuides });

export const useFaq = () =>
  useQuery({ queryKey: ['pages', 'faq'], queryFn: fetchFaq });

export const useReviews = () =>
  useQuery({ queryKey: ['pages', 'reviews'], queryFn: fetchReviews });

export const useStaticPage = (slug: string) =>
  useQuery({ queryKey: ['pages', 'static', slug], queryFn: () => fetchStaticPage(slug), retry: false });
