import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Bot, Mic, Send, Shield, Sparkles, Volume2 } from "lucide-react-native";
import Tts from "react-native-tts";
import type { AgentResponse } from "@fintwin/shared";
import { sendAgentMessage } from "../api";
import { Btn, Card, Chip, Eyebrow, KV, Muted, ScreenHeader, SectionTitle } from "../ui";
import { radius, space, usePalette } from "../theme";

const SUGGESTIONS = [
  "Bugün 10000 TL teknoloji harcaması yaparsam ne olur?",
  "Bu ay tasarrufumu nasıl artırırım?",
  "Aboneliklerimden hangileri sızıntı?",
  "Ay sonu bakiyem ne kadar olur?"
];

export function AgentScreen() {
  const p = usePalette();
  const [message, setMessage] = useState(SUGGESTIONS[0]);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask() {
    setLoading(true);
    const next = await sendAgentMessage(message);
    setResponse(next);
    Tts.setDefaultLanguage("tr-TR").catch(() => undefined);
    Tts.speak(next.answer);
    setLoading(false);
  }

  function speak(text: string) {
    Tts.setDefaultLanguage("tr-TR").catch(() => undefined);
    Tts.speak(text);
  }

  return (
    <View style={{ gap: space[4] }}>
      <ScreenHeader eyebrow="Finans Asistanı" title="Sor, açıklayalım." subtitle="Her cevap kanıtlarla ve güven skoru ile birlikte gelir." />

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 99, backgroundColor: p.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Bot color={p.accent} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.ink, fontWeight: "900", fontSize: 14 }}>Fintwin Agent</Text>
            <Text style={{ color: p.muted, fontSize: 12 }}>Supervisor · Simulation · Risk</Text>
          </View>
          <Chip label="Çevrimiçi" tone="good" small />
        </View>

        <TextInput
          value={message}
          onChangeText={setMessage}
          multiline
          style={{
            minHeight: 96,
            borderColor: p.line,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: 12,
            color: p.ink,
            fontSize: 14,
            lineHeight: 20,
            backgroundColor: p.surface2,
            textAlignVertical: "top"
          }}
        />
        <View style={{ flexDirection: "row", gap: 6 }}>
          <View style={{ flex: 2 }}>
            <Btn label={loading ? "Analiz ediliyor…" : "Sor ve sesli oku"} onPress={ask} variant="primary" disabled={loading} icon={<Send color={p.surface} size={14} />} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn label="Sesli sor" onPress={() => undefined} variant="secondary" icon={<Mic color={p.ink} size={14} />} />
          </View>
        </View>
      </Card>

      <View style={{ gap: 8 }}>
        <Eyebrow tone="muted">Önerilen sorular</Eyebrow>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setMessage(s)}
              android_ripple={{ color: p.line }}
              style={{ borderColor: p.line, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: p.surface }}
            >
              <Text style={{ color: p.ink, fontSize: 12, fontWeight: "700" }}>{s}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading && !response ? (
        <Card>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <ActivityIndicator color={p.accent} />
            <Text style={{ color: p.muted, fontSize: 13 }}>Routed agents çağrılıyor…</Text>
          </View>
        </Card>
      ) : null}

      {response ? (
        <View style={{ gap: space[3] }}>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <SectionTitle>Cevap</SectionTitle>
              <Pressable onPress={() => speak(response.answer)} android_ripple={{ color: p.line }} style={{ flexDirection: "row", gap: 6, alignItems: "center", padding: 6 }}>
                <Volume2 color={p.accent} size={16} />
                <Text style={{ color: p.accent, fontSize: 12, fontWeight: "800" }}>Sesli oku</Text>
              </Pressable>
            </View>
            <Text style={{ color: p.ink, fontSize: 14, lineHeight: 22 }}>{response.answer}</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Shield color={p.accent} size={14} />
                <Text style={{ color: p.muted, fontSize: 12 }}>Güven skoru</Text>
              </View>
              <Text style={{ color: p.accent, fontWeight: "900", fontSize: 14 }}>%{Math.round(response.confidence * 100)}</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {response.routedAgents.map((a) => (
                <Chip key={a} label={a} tone="accent" small />
              ))}
            </View>
          </Card>

          {response.evidence.length ? (
            <Card>
              <SectionTitle>Kanıtlar</SectionTitle>
              {response.evidence.map((e, i) => (
                <View key={`${e.label}-${i}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopColor: p.line, borderTopWidth: i === 0 ? 0 : 1 }}>
                  <Text style={{ color: p.muted, fontSize: 13, flex: 1, paddingRight: 10 }}>{e.label}</Text>
                  <Text style={{ color: p.ink, fontWeight: "800", fontSize: 13 }}>{e.value}</Text>
                </View>
              ))}
            </Card>
          ) : null}

          {response.suggestedActions.length ? (
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <SectionTitle>Önerilen aksiyonlar</SectionTitle>
                <Sparkles color={p.muted} size={14} />
              </View>
              {response.suggestedActions.map((a, i) => (
                <View
                  key={`${a.title ?? i}-${i}`}
                  style={{ borderColor: p.line, borderWidth: 1, borderRadius: radius.md, padding: space[3], gap: 6, backgroundColor: p.surface2 }}
                >
                  <Text style={{ color: p.ink, fontWeight: "900", fontSize: 13 }}>{a.title ?? `Aksiyon ${i + 1}`}</Text>
                  {a.description ? <Text style={{ color: p.muted, fontSize: 12, lineHeight: 17 }}>{a.description}</Text> : null}
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <View style={{ flex: 1 }}>
                      <Btn label="Onayla" onPress={() => undefined} variant="primary" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Btn label="Reddet" onPress={() => undefined} variant="ghost" />
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          ) : null}
        </View>
      ) : null}

      <View style={{ height: space[5] }} />
    </View>
  );
}
