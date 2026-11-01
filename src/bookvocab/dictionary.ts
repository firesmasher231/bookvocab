import type { Definition, Lookup } from "./model";

const MW_API = "https://www.dictionaryapi.com/api/v3/references/collegiate/json";
const FREE_API = "https://api.dictionaryapi.dev/api/v2/entries/en";
const KEY_STORAGE = "bookvocab.mwApiKey";

export function getApiKey(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    const key = (localStorage.getItem(KEY_STORAGE) || "").trim();
    return key === "your-api-key-here" ? "" : key;
  } catch {
    return "";
  }
}

export function setApiKey(key: string): void {
  const value = key.trim();
  if (value) localStorage.setItem(KEY_STORAGE, value);
  else localStorage.removeItem(KEY_STORAGE);
}

function cleanMarkup(text: string): string {
  return text
    .replace(/\{bc\}/g, ": ")
    .replace(/\{ldquo\}/g, "\u201C")
    .replace(/\{rdquo\}/g, "\u201D")
    .replace(/\{it\}(.*?)\{\/it\}/g, "$1")
    .replace(/\{sx\|([^|]*)\|[^}]*\}/g, "$1")
    .replace(/\{a_link\|([^}]+)\}/g, "$1")
    .replace(/\{d_link\|([^|]+)\|[^}]*\}/g, "$1")
    .replace(/\{[^}]+\}/g, "")
    .trim();
}

function audioUrl(file: string | undefined): string | null {
  if (!file) return null;
  let sub = file[0];
  if (file.startsWith("bix")) sub = "bix";
  else if (file.startsWith("gg")) sub = "gg";
  else if (/^[0-9_]/.test(file)) sub = "number";
  return `https://media.merriam-webster.com/audio/prons/en/us/mp3/${sub}/${file}.mp3`;
}

async function lookupMerriam(word: string, key: string): Promise<Lookup> {
  const response = await fetch(`${MW_API}/${encodeURIComponent(word)}?key=${encodeURIComponent(key)}`);
  if (response.status === 401) throw new Error("Invalid API key. Check your Merriam-Webster key.");
  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    if (/invalid api key|key required|not subscribed/i.test(text)) {
      throw new Error("Invalid API key. Check your Merriam-Webster key.");
    }
    throw new Error("Unexpected response from the dictionary.");
  }
  if (!Array.isArray(data) || data.length === 0) return { found: false, suggestions: [] };
  if (typeof data[0] === "string") {
    return { found: false, suggestions: data.filter((item) => typeof item === "string").slice(0, 5) as string[] };
  }
  const entry = data[0] as {
    meta?: { id?: string };
    hwi?: { prs?: { mw?: string; sound?: { audio?: string } }[] };
    fl?: string;
    shortdef?: string[];
  };
  const definitions: Definition[] = (entry.shortdef || []).map((definition) => ({
    partOfSpeech: entry.fl || "",
    definition: cleanMarkup(definition),
    examples: [],
  }));
  if (!definitions.length) return { found: false, suggestions: [] };
  return {
    found: true,
    word: (entry.meta?.id?.split(":")[0] || word).toLowerCase(),
    phonetic: entry.hwi?.prs?.[0]?.mw || "",
    audioUrl: audioUrl(entry.hwi?.prs?.[0]?.sound?.audio),
    definitions,
  };
}

async function lookupFree(word: string): Promise<Lookup> {
  const response = await fetch(`${FREE_API}/${encodeURIComponent(word)}`);
  if (response.status === 404) return { found: false, suggestions: [] };
  if (!response.ok) throw new Error("Could not reach the dictionary.");
  const data = (await response.json()) as {
    word?: string;
    phonetic?: string;
    phonetics?: { text?: string; audio?: string }[];
    meanings?: { partOfSpeech?: string; definitions?: { definition?: string; example?: string }[] }[];
  }[];
  const entry = data[0];
  if (!entry) return { found: false, suggestions: [] };
  const definitions: Definition[] = [];
  for (const meaning of entry.meanings || []) {
    for (const def of meaning.definitions || []) {
      if (!def.definition) continue;
      definitions.push({
        partOfSpeech: meaning.partOfSpeech || "",
        definition: def.definition,
        examples: def.example ? [def.example] : [],
      });
      if (definitions.length >= 3) break;
    }
    if (definitions.length >= 3) break;
  }
  if (!definitions.length) return { found: false, suggestions: [] };
  const phonetic = entry.phonetic || entry.phonetics?.find((item) => item.text)?.text || "";
  const sound = entry.phonetics?.find((item) => item.audio)?.audio || null;
  return {
    found: true,
    word: (entry.word || word).toLowerCase(),
    phonetic,
    audioUrl: sound,
    definitions,
  };
}

export async function lookupWord(raw: string): Promise<Lookup> {
  const word = raw.trim().toLowerCase();
  if (!word) return { found: false, suggestions: [] };
  const key = getApiKey();
  if (key) return lookupMerriam(word, key);
  return lookupFree(word);
}
