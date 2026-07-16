import { useQuery } from '@tanstack/react-query';
import { fetchRoadmap, fetchChangelog, fetchGuides, fetchFaq, fetchReviews } from './repo';

export const useRoadmap = () =>
  useQuery({ queryKey: ['pages', 'roadmap'], queryFn: fetchRoadmap });

export const useChangelog = () =>
  useQuery({ queryKey: ['pages', 'changelog'], queryFn: fetchChangelog });

export const useGuides = () =>
  useQuery({ queryKey: ['pages', 'guides'], queryFn: fetchGuides });

export const useFaq = () =>
  useQuery({ queryKey: ['pages', 'faq'], queryFn: fetchFaq });

export const useReviews = () =>
  useQuery({ queryKey: ['pages', 'reviews'], queryFn: fetchReviews });
