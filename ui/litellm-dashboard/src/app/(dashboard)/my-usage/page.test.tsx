import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, testQueryClient } from "../../../../tests/test-utils";
import MyUsagePage from "./page";
import { apiClient } from "@/components/networking";
import useAuthorized from "@/app/(dashboard)/hooks/useAuthorized";
import { ApiError } from "@/lib/http/client";

vi.mock("@/components/networking", () => ({ apiClient: { get: vi.fn() } }));
vi.mock("@/app/(dashboard)/hooks/useAuthorized", () => ({ default: vi.fn() }));

const session = (over = {}) => ({ accessToken: "sk-session", userId: "ana", isLoading: false, isAuthorized: true, ...over });

const team = (over = {}) => ({
  team_id: "t1",
  team_alias: "Equipo Demo",
  period_start: "2026-11-01",
  resets_on: "2026-12-01",
  models: [
    { model: "mimo2.6-flash", used_tokens: 4000, limit_tokens: 5000, remaining_tokens: 1000, percent_used: 80 },
    { model: "deepseek-v4-flash", used_tokens: 2000, limit_tokens: 2000, remaining_tokens: 0, percent_used: 100 },
    { model: "glm-5.3-flash", used_tokens: 0, limit_tokens: 250_000_000, remaining_tokens: 250_000_000, percent_used: 0 },
  ],
  ...over,
});

describe("MyUsagePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testQueryClient.clear(); // el QueryClient de test es compartido: sin esto un test reutiliza los datos del anterior
    vi.mocked(useAuthorized).mockReturnValue(session() as never);
  });

  it("consulta /quota/me con la sesión y muestra los tres estados con texto", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ teams: [team()] });
    renderWithProviders(<MyUsagePage />);

    expect(await screen.findByText("Equipo Demo")).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith("/quota/me", { accessToken: "sk-session" });
    expect(screen.getByText(/Cerca del tope · 80 %/)).toBeInTheDocument();
    expect(screen.getByText(/Agotado · 100 %/)).toBeInTheDocument();
    expect(screen.getByText(/Disponible · 0 %/)).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar")).toHaveLength(3);
  });

  it("anuncia la carga con texto accesible", () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<MyUsagePage />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando tu consumo");
  });

  it("explica el 400 (sin team) y no muestra datos", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new ApiError("sin team", 400, null));
    renderWithProviders(<MyUsagePage />);
    expect(await screen.findByText(/No perteneces a ningún team/)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("muestra el código en otros errores HTTP", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new ApiError("boom", 500, null));
    renderWithProviders(<MyUsagePage />);
    // el hook reintenta una vez los errores 5xx (con espera), así que el mensaje tarda más que en el 400
    expect(await screen.findByText(/error 500/, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it("no consulta sin sesión y no mezcla datos de otro usuario", async () => {
    vi.mocked(useAuthorized).mockReturnValue(session({ accessToken: null, userId: null, isAuthorized: false }) as never);
    renderWithProviders(<MyUsagePage />);
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it("al cambiar de usuario pide los datos de nuevo en vez de reutilizar los anteriores", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ teams: [team({ team_alias: "Equipo de Ana" })] });
    const { rerender } = renderWithProviders(<MyUsagePage />);
    expect(await screen.findByText("Equipo de Ana")).toBeInTheDocument();

    vi.mocked(useAuthorized).mockReturnValue(session({ accessToken: "sk-otro", userId: "beto" }) as never);
    vi.mocked(apiClient.get).mockResolvedValueOnce({ teams: [team({ team_alias: "Equipo de Beto" })] });
    rerender(<MyUsagePage />);
    expect(await screen.findByText("Equipo de Beto")).toBeInTheDocument();
    expect(screen.queryByText("Equipo de Ana")).not.toBeInTheDocument();
  });
});
