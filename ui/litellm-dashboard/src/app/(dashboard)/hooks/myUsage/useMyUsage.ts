"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiClient } from "@/components/networking";
import { ApiError } from "@/lib/http/client";

// Consumo de tokens del usuario: lee GET /quota/me del proxy (endpoint propio del backend).

export interface ModelQuota {
  model: string;
  used_tokens: number;
  limit_tokens: number;
  remaining_tokens: number;
  percent_used: number;
}

export interface TeamQuota {
  team_id: string;
  team_alias?: string | null;
  period_start: string;
  resets_on: string;
  models: ModelQuota[];
}

export interface MyUsageResponse {
  teams?: TeamQuota[];
}

export const myUsageKeys = { all: ["my-usage"] as const };

const MY_USAGE_PATH = "/quota/me";
const NO_RETRY_STATUSES = [400, 401, 403];

// La clave de la query lleva el userId (no el token): al cambiar de usuario no se reutilizan datos ajenos.
export const useMyUsage = (accessToken: string | null, userId: string | null): UseQueryResult<MyUsageResponse, Error> => {
  const queryOptions = {
    queryKey: [...myUsageKeys.all, userId],
    queryFn: () => apiClient.get<MyUsageResponse>(MY_USAGE_PATH, { accessToken }),
    enabled: Boolean(accessToken),
    staleTime: 30_000,
    retry: (failureCount: number, error: Error) =>
      !(error instanceof ApiError && NO_RETRY_STATUSES.includes(error.status)) && failureCount < 1,
  };
  return useQuery(queryOptions);
};
