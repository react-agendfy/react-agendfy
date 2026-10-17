import React, { useState, useCallback, FC } from "react";
import {
  useAIEventParser,
  useEventEditing,
  useAgenda,
  useBatchParser,
  useSmartReminders,
  useAvailability,
  useConflictResolution,
  detectConflicts,
  go4aiAdapter,
  httpAdapter,
  type AgendfyEvent,
} from "@react-agendfy/ai";

const adapter = import.meta.env.VITE_GO4AI_API_KEY
  ? go4aiAdapter({
      apiKey: import.meta.env.VITE_GO4AI_API_KEY,
      baseUrl: import.meta.env.VITE_GO4AI_BASE_URL || "https://ai.go4ai.io/v1",
      model:
        import.meta.env.VITE_GO4AI_MODEL ||
        "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
      dangerouslyAllowBrowser: true,
    })
  : import.meta.env.VITE_AI_PROXY
    ? httpAdapter({ endpoint: import.meta.env.VITE_AI_PROXY })
    : undefined;

interface AIPanelProps {
  events: AgendfyEvent[];
  onEventCreate: (event: any) => void;
  onEventUpdate: (event: any) => void;
  onEventDelete: (eventId: string) => void;
  timeZone?: string;
}

type Tab = "edit" | "agenda" | "batch" | "reminders" | "availability" | "conflicts";

const AIPanel: FC<AIPanelProps> = ({
  events,
  onEventCreate,
  onEventUpdate,
  onEventDelete,
  timeZone = "Africa/Lagos",
}) => {
  const [activeTab, setActiveTab] = useState<Tab>("edit");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<string>("");

  const parser = useAIEventParser(adapter, { timeZone, locale: "pt-BR" });
  const editor = useEventEditing(adapter, { timeZone, locale: "pt-BR" });
  const agenda = useAgenda(adapter, { period: "day", timeZone });
  const batch = useBatchParser(adapter, { timeZone, locale: "pt-BR" });
  const reminders = useSmartReminders(adapter, { timeZone });
  const availability = useAvailability(adapter, { timeZone });
  const conflictRes = useConflictResolution(adapter, { timeZone });

  const loading =
    parser.loading ||
    editor.loading ||
    agenda.loading ||
    batch.loading ||
    reminders.loading ||
    availability.loading ||
    conflictRes.loading;

  const handleAction = useCallback(async () => {
    if (!input.trim() || loading) return;
    setOutput("");

    try {
      switch (activeTab) {
        case "edit": {
          const result = await editor.edit(input, events);
          if (!result) {
            setOutput("Nenhum evento encontrado para editar.");
            return;
          }
          if (result.action === "delete") {
            setOutput(`A apagar evento "${result.eventId}"...`);
            onEventDelete(result.eventId);
          } else if (result.action === "reschedule" && result.updates) {
            const event = events.find((e) => e.id === result.eventId);
            if (event) {
              const updated = { ...event, ...result.updates };
              setOutput(`A mudar "${event.title}" para ${result.updates.start}...`);
              onEventUpdate(updated);
            }
          } else if (result.action === "rename" && result.updates?.title) {
            const event = events.find((e) => e.id === result.eventId);
            if (event) {
              const updated = { ...event, title: result.updates.title };
              setOutput(`A renomear para "${result.updates.title}"...`);
              onEventUpdate(updated);
            }
          } else {
            setOutput(`Ação: ${result.action} no evento ${result.eventId}`);
          }
          break;
        }
        case "agenda": {
          const result = await agenda.generate(events);
          if (!result) {
            setOutput("Erro ao gerar agenda.");
            return;
          }
          const lines = result.items.map(
            (i) => `${i.timeRange} — ${i.event.title} (${i.durationMinutes}min)`
          );
          let text = `📅 Agenda (${result.stats.eventCount} eventos, ${result.stats.totalMeetingHours}h total)\n\n`;
          text += lines.join("\n") || "(sem eventos)";
          if (result.summary) text += `\n\n${result.summary}`;
          setOutput(text);
          break;
        }
        case "batch": {
          const result = await batch.parse(input);
          if (!result) {
            setOutput("Erro ao processar lote.");
            return;
          }
          const lines = result.events.map(
            (e, i) => `${i + 1}. ${e.event.title} — ${e.event.start} [${e.confidence}]`
          );
          let text = `✅ ${result.events.length} eventos criados:\n\n`;
          text += lines.join("\n");
          if (result.failed.length) {
            text += `\n\n❌ ${result.failed.length} falharam:`;
            result.failed.forEach((f) => (text += `\n  - ${f.input}: ${f.error}`));
          }
          setOutput(text);
          result.events.forEach((e) => onEventCreate(e.event));
          break;
        }
        case "reminders": {
          const result = await reminders.suggest(events);
          if (!result) {
            setOutput("Erro ao sugerir lembretes.");
            return;
          }
          const lines = result.map(
            (r) => {
              const event = events.find((e) => e.id === r.eventId);
              return `⏰ ${event?.title ?? r.eventId}: ${r.minutes}min ${r.trigger === "before-start" ? "antes" : "depois"}\n   ${r.reason}`;
            }
          );
          setOutput(`Lembretes sugeridos:\n\n${lines.join("\n\n") || "Nenhum lembrete sugerido."}`);
          break;
        }
        case "availability": {
          const result = await availability.check(input, events);
          if (!result) {
            setOutput("Erro ao verificar disponibilidade.");
            return;
          }
          setOutput(result.answer);
          break;
        }
        case "conflicts": {
          const conflicts = detectConflicts(events, { timeZone });
          if (conflicts.length === 0) {
            setOutput("Nenhum conflito encontrado nos eventos.");
            return;
          }
          const result = await conflictRes.resolve(events, conflicts);
          if (!result) {
            setOutput("Erro ao resolver conflitos.");
            return;
          }
          const lines = result.map(
            (r) =>
              `⚠️ Conflito: ${r.conflict.eventIds.join(" & ")}\n   💡 ${r.suggestion}${r.proposedFix ? `\n   📌 Mover para: ${r.proposedFix.newStart}` : ""}`
          );
          setOutput(lines.join("\n\n"));
          break;
        }
      }
    } catch (err) {
      setOutput(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [input, activeTab, events, loading, onEventCreate, onEventUpdate, onEventDelete]);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "edit", label: "Editar", icon: "✏️" },
    { key: "agenda", label: "Agenda", icon: "📅" },
    { key: "batch", label: "Lote", icon: "📋" },
    { key: "reminders", label: "Lembretes", icon: "⏰" },
    { key: "availability", label: "Disponibilidade", icon: "🔍" },
    { key: "conflicts", label: "Conflitos", icon: "⚠️" },
  ];

  const placeholders: Record<Tab, string> = {
    edit: 'Ex: "cancela a reunião de sprint" ou "muda para as 14h"',
    agenda: "Clique em gerar para ver a agenda do dia",
    batch: 'Ex: "standup às 9h, 1:1 com Pedro às 14h"',
    reminders: "Clique em sugerir para ver lembretes",
    availability: 'Ex: "quando posso ter uma reunião de 1h?"',
    conflicts: "Clique em verificar para ver conflitos",
  };

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <span className="ai-panel-title">🤖 AI Assistant</span>
        {!adapter && (
          <span className="ai-panel-badge">Offline (parser local)</span>
        )}
      </div>

      <div className="ai-panel-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`ai-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => {
              setActiveTab(tab.key);
              setInput("");
              setOutput("");
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="ai-panel-body">
        {(activeTab === "agenda" || activeTab === "reminders" || activeTab === "conflicts") && !input ? (
          <div className="ai-panel-hint">
            {activeTab === "agenda" && "Gera a agenda do dia/semana com resumo."}
            {activeTab === "reminders" && "Sugere lembretes inteligentes para cada evento."}
            {activeTab === "conflicts" && "Detecta e sugere resoluções para conflitos."}
          </div>
        ) : (
          <textarea
            className="ai-panel-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholders[activeTab]}
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAction();
              }
            }}
          />
        )}

        <button
          className="ai-panel-btn"
          onClick={handleAction}
          disabled={loading || (!(activeTab === "agenda" || activeTab === "reminders" || activeTab === "conflicts") && !input.trim())}
        >
          {loading ? "A processar..." : "Executar"}
        </button>

        {output && (
          <pre className="ai-panel-output">{output}</pre>
        )}
      </div>
    </div>
  );
};

export default AIPanel;
