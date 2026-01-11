import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { getTransport } from '@/lib/transport';
import type { Cooldown } from '@/lib/transport';
import { useEffect, useState } from 'react';

export function useCooldowns() {
  const queryClient = useQueryClient();
  const transport = getTransport();
  const [, setTick] = useState(0); // Force re-render every second

  const { data: cooldowns = [], isLoading, error } = useQuery({
    queryKey: ['cooldowns'],
    queryFn: () => transport.getCooldowns(),
    refetchInterval: 5000, // Refetch every 5 seconds from server
    staleTime: 3000,
  });

  // Mutation for clearing cooldown
  const clearCooldownMutation = useMutation({
    mutationFn: (providerId: number) => transport.clearCooldown(providerId),
    onSuccess: () => {
      // Invalidate and refetch cooldowns after successful deletion
      queryClient.invalidateQueries({ queryKey: ['cooldowns'] });
    },
  });

  // Update countdown display every second (client-side only, no server request)
  useEffect(() => {
    if (cooldowns.length === 0) {
      return;
    }

    const interval = setInterval(() => {
      setTick(prev => prev + 1); // Trigger re-render to update countdown
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [cooldowns.length]);

  // Helper to get cooldown for a specific provider
  const getCooldownForProvider = (providerId: number, clientType?: string) => {
    return cooldowns.find(
      (cd: Cooldown) =>
        cd.providerID === providerId &&
        (cd.clientType === '' || cd.clientType === 'all' || (clientType && cd.clientType === clientType))
    );
  };

  // Helper to check if provider is in cooldown
  const isProviderInCooldown = (providerId: number, clientType?: string) => {
    return !!getCooldownForProvider(providerId, clientType);
  };

  // Helper to get remaining time as seconds
  const getRemainingSeconds = (cooldown: Cooldown) => {
    const until = new Date(cooldown.until);
    const now = new Date();
    const diff = until.getTime() - now.getTime();
    return Math.max(0, Math.floor(diff / 1000));
  };

  // Helper to format remaining time
  const formatRemaining = (cooldown: Cooldown) => {
    const seconds = getRemainingSeconds(cooldown);

    if (seconds === 0) return 'Expired';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    } else if (minutes > 0) {
      return `${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    } else {
      return `${String(secs).padStart(2, '0')}s`;
    }
  };

  // Helper to clear cooldown
  const clearCooldown = (providerId: number) => {
    clearCooldownMutation.mutate(providerId);
  };

  return {
    cooldowns,
    isLoading,
    error,
    getCooldownForProvider,
    isProviderInCooldown,
    getRemainingSeconds,
    formatRemaining,
    clearCooldown,
    isClearingCooldown: clearCooldownMutation.isPending,
  };
}
