"use client";

import { useMyUsage } from "@/app/(dashboard)/hooks/myUsage/useMyUsage";
import type { ModelQuota } from "@/app/(dashboard)/hooks/myUsage/useMyUsage";
import useAuthorized from "@/app/(dashboard)/hooks/useAuthorized";
import LoadingScreen from "@/components/common_components/LoadingScreen";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/http/client";
import { cn } from "@/lib/cva.config";

// Consumo de tokens del usuario contra su tope mensual.

const fmt = (n: number): string => {
  if (n >= 1e9) return `${(n / 1e9).toLocaleString("es-PE", { maximumFractionDigits: 2 })} B`;
  if (n >= 1e6) return `${(n / 1e6).toLocaleString("es-PE", { maximumFractionDigits: 1 })} M`;
  if (n >= 1e3) return `${(n / 1e3).toLocaleString("es-PE", { maximumFractionDigits: 1 })} mil`;
  return String(n);
};

const day = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });

// El estado se dice con texto además del color; los tonos verde/ámbar/rojo no dependen del tema.
const stateOf = (pct: number) => {
  if (pct >= 100) {
    return { label: "Agotado", badge: "destructive" as const, badgeClass: "", bar: "bg-destructive" };
  }
  if (pct >= 80) {
    return {
      label: "Cerca del tope",
      badge: "outline" as const,
      badgeClass: "border-amber-500/50 text-amber-600 dark:text-amber-400",
      bar: "bg-amber-500",
    };
  }
  return {
    label: "Disponible",
    badge: "outline" as const,
    badgeClass: "border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
  };
};

const errorMessage = (error: unknown): string => {
  if (error instanceof ApiError && error.status === 400) {
    return "No perteneces a ningún team, así que no tienes cuota asignada.";
  }
  if (error instanceof ApiError) {
    return `No se pudo consultar tu consumo (error ${error.status}).`;
  }
  return "No se pudo conectar con el servidor.";
};

function ModelCard({ m }: { m: ModelQuota }) {
  const st = stateOf(m.percent_used);
  const pct = Math.min(m.percent_used, 100);
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{m.model}</CardTitle>
          <Badge variant={st.badge} className={st.badgeClass}>
            {st.label} · {m.percent_used.toLocaleString("es-PE")} %
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div
          role="progressbar"
          aria-label={`Uso de ${m.model}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          className="h-2.5 overflow-hidden rounded-full bg-muted"
        >
          <div className={cn("h-full", st.bar)} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-muted-foreground">
          Usados {fmt(m.used_tokens)} de {fmt(m.limit_tokens)} · te quedan {fmt(m.remaining_tokens)}
        </p>
      </CardContent>
    </Card>
  );
}

export default function MyUsagePage() {
  const { accessToken, userId, isLoading, isAuthorized } = useAuthorized();
  const { data, error, isPending } = useMyUsage(accessToken, userId);

  if (isLoading || !isAuthorized) return <LoadingScreen />;

  const teams = data?.teams ?? [];
  const isEmpty = !isPending && !error && teams.length === 0;
  const showTeams = !error && teams.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Mi consumo</h1>
        <p className="text-sm text-muted-foreground">Cuánto llevas este ciclo y cuánto te queda, por modelo.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo cargar tu consumo</AlertTitle>
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      )}

      {isPending && !error && (
        <div role="status" aria-live="polite" className="space-y-3">
          <span className="sr-only">Cargando tu consumo…</span>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {isEmpty && <p className="text-sm text-muted-foreground">No hay consumo para mostrar.</p>}

      {showTeams &&
        teams.map((team) => (
          <section key={team.team_id} className="space-y-3">
            <div>
              <h2 className="font-medium text-foreground">{team.team_alias || team.team_id}</h2>
              <p className="text-sm text-muted-foreground">
                Ciclo desde el {day(team.period_start)}. Se reinicia el {day(team.resets_on)}.
              </p>
            </div>
            {team.models.map((m) => (
              <ModelCard key={m.model} m={m} />
            ))}
          </section>
        ))}
    </div>
  );
}
