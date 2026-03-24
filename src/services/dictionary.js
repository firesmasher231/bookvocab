const MW_API_BASE =
	"https://www.dictionaryapi.com/api/v3/references/collegiate/json";

/**
 * Get API key from environment variable
 * @returns {string}
 */
function getApiKey() {
	const key = "abd7dc3a-032c-422d-806c-4830a3416bac";
	if (!key || key === "your-api-key-here") {
		throw new Error(
			"Merriam-Webster API key not configured. Please add your API key to the .env file."
		);
	}
	return key;
}

/**
 * Build audio URL from Merriam-Webster audio object
 * @param {string} audioFile - Audio filename from API
 * @returns {string|null}
 */
function buildAudioUrl(audioFile) {
	if (!audioFile) return null;

	// Determine subdirectory based on MW API rules
	let subdir;
	if (audioFile.startsWith("bix")) {
		subdir = "bix";
	} else if (audioFile.startsWith("gg")) {
		subdir = "gg";
	} else if (/^[0-9_]/.test(audioFile)) {
		subdir = "number";
	} else {
		subdir = audioFile[0];
	}

	return `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdir}/${audioFile}.mp3`;
}

/**
 * Clean Merriam-Webster markup from text
 * Handles {bc}, {it}...{/it}, {sx|word||}, {a_link|word}, {d_link|word|id},
 * {ldquo}, {rdquo}, and other MW-specific markers
 * @param {string} text - Raw text with MW markup
 * @returns {string}
 */
function cleanMWMarkup(text) {
	if (!text) return "";
	return text
		.replace(/\{bc\}/g, ": ")                          // bold colon → ": "
		.replace(/\{ldquo\}/g, "\u201C")                   // left double quote
		.replace(/\{rdquo\}/g, "\u201D")                   // right double quote
		.replace(/\{it\}(.*?)\{\/it\}/g, "$1")             // italic → keep text
		.replace(/\{b\}(.*?)\{\/b\}/g, "$1")               // bold → keep text
		.replace(/\{inf\}(.*?)\{\/inf\}/g, "$1")           // subscript → keep text
		.replace(/\{sup\}(.*?)\{\/sup\}/g, "$1")           // superscript → keep text
		.replace(/\{sx\|([^|]*)\|[^}]*\}/g, "$1")          // cross-ref → keep word
		.replace(/\{a_link\|([^}]+)\}/g, "$1")             // auto link → keep word
		.replace(/\{d_link\|([^|]+)\|[^}]*\}/g, "$1")      // definition link → keep word
		.replace(/\{DRB\}/g, "")                           // definition reference block
		.replace(/\{\/DRB\}/g, "")
		.replace(/\{ma\}(.*?)\{\/ma\}/g, "$1")             // more at → keep text
		.replace(/\{wi\}(.*?)\{\/wi\}/g, "$1")             // word in italic → keep text
		.replace(/\{phrase\}(.*?)\{\/phrase\}/g, "$1")      // phrase → keep text
		.replace(/\{qword\}(.*?)\{\/qword\}/g, "$1")       // query word → keep text
		.replace(/\{gloss\}(.*?)\{\/gloss\}/g, "$1")       // gloss → keep text
		.replace(/\{parahw\}(.*?)\{\/parahw\}/g, "$1")     // paragraph headword → keep text
		.replace(/\{[^}]+\}/g, "")                         // catch-all for any remaining markers
		.trim();
}

/**
 * Parse full definitions from API response
 * @param {Array} defArray - Definitions array from API
 * @returns {Array}
 */
function parseFullDefinitions(defArray, fallbackPartOfSpeech = "") {
	if (!defArray || !Array.isArray(defArray)) return [];

	const definitions = [];

	defArray.forEach((defSection) => {
		if (!defSection.sseq) return;

		defSection.sseq.forEach((senseSeq) => {
			senseSeq.forEach((sense) => {
				if (sense[0] === "sense") {
					const dt = sense[1].dt;
					if (dt && Array.isArray(dt)) {
						dt.forEach((defItem) => {
							if (defItem[0] === "text") {
								const cleanText = cleanMWMarkup(defItem[1]);
								if (cleanText) {
									definitions.push({
										partOfSpeech: defSection.vd || fallbackPartOfSpeech,
										definition: cleanText,
										examples: [],
									});
								}
							} else if (defItem[0] === "vis") {
								// Extract examples
								const examples = defItem[1]
									.map((ex) => {
										if (ex.t) {
											return cleanMWMarkup(ex.t);
										}
										return "";
									})
									.filter(Boolean);

								if (definitions.length > 0 && examples.length > 0) {
									definitions[definitions.length - 1].examples = examples;
								}
							}
						});
					}
				}
			});
		});
	});

	return definitions;
}

/**
 * Look up a word in the Merriam-Webster dictionary
 * @param {string} word - Word to look up
 * @returns {Promise<Object>} - Parsed word data or suggestions
 */
export async function lookupWord(word) {
	if (!word || typeof word !== "string") {
		throw new Error("Invalid word parameter");
	}

	const apiKey = getApiKey();
	const searchWord = word.trim().toLowerCase();

	try {
		const response = await fetch(
			`${MW_API_BASE}/${encodeURIComponent(searchWord)}?key=${apiKey}`
		);

		if (!response.ok) {
			if (response.status === 401) {
				throw new Error(
					"Invalid API key. Please check your Merriam-Webster API key."
				);
			} else if (response.status === 404) {
				return { suggestions: [] };
			} else {
				throw new Error(`API error: ${response.status}`);
			}
		}

		const data = await response.json();

		// Handle "no results" - API returns array of suggested words (strings)
		if (Array.isArray(data) && data.length > 0 && typeof data[0] === "string") {
			return {
				found: false,
				suggestions: data.slice(0, 5), // Limit to 5 suggestions
			};
		}

		// No data returned
		if (!Array.isArray(data) || data.length === 0) {
			return {
				found: false,
				suggestions: [],
			};
		}

		// Parse definition data (use first entry)
		const entry = data[0];

		// Extract the base word (remove variant markers)
		const baseWord = entry.meta?.id?.split(":")[0] || searchWord;

		// Get phonetic pronunciation
		const phonetic = entry.hwi?.prs?.[0]?.mw || "";

		// Get audio URL
		const audioFile = entry.hwi?.prs?.[0]?.sound?.audio;
		const audioUrl = buildAudioUrl(audioFile);

		// Get simplified definitions
		const shortDefs = entry.shortdef || [];

		// Get functional label (part of speech)
		const partOfSpeech = entry.fl || "";

		// Get full definitions with examples
		const fullDefs = parseFullDefinitions(entry.def, partOfSpeech);

		// Format definitions array
		const definitions =
			fullDefs.length > 0
				? fullDefs
				: shortDefs.map((def) => ({
						partOfSpeech: partOfSpeech,
						definition: def,
						examples: [],
				  }));

		return {
			found: true,
			word: baseWord,
			phonetic,
			audioUrl,
			definitions,
			partOfSpeech,
		};
	} catch (error) {
		console.error("Dictionary lookup failed:", error);

		// Provide user-friendly error messages
		if (error.message.includes("API key")) {
			throw error;
		} else if (error.message.includes("Failed to fetch")) {
			throw new Error("Network error. Please check your internet connection.");
		} else {
			throw new Error("Failed to lookup word. Please try again.");
		}
	}
}

/**
 * Check if a word exists in the dictionary
 * @param {string} word - Word to check
 * @returns {Promise<boolean>}
 */
export async function wordExists(word) {
	try {
		const result = await lookupWord(word);
		return result.found === true;
	} catch (error) {
		return false;
	}
}
