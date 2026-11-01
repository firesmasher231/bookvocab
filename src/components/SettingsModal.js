import { createElement, hapticFeedback, showToast } from "../utils/helpers.js";
import { getApiKey, setApiKey } from "../services/dictionary.js";

let openOverlay = null;

/**
 * Open the settings modal (dictionary API key).
 * @param {Object} [options]
 * @param {string} [options.reason] - Optional note shown above the form
 */
export function openSettingsModal(options = {}) {
	if (openOverlay) return;

	const close = () => {
		if (!openOverlay) return;
		openOverlay.remove();
		openOverlay = null;
		document.removeEventListener("keydown", onKey);
	};
	const onKey = (e) => {
		if (e.key === "Escape") close();
	};

	const overlay = createElement("div", {
		style: `
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; padding: 1rem;
      animation: fadeIn 0.2s ease;
    `,
		onClick: (e) => {
			if (e.target === overlay) close();
		},
	});

	const modal = createElement("div", {
		role: "dialog",
		"aria-modal": "true",
		"aria-labelledby": "settings-title",
		style: `
      max-width: 420px; width: 100%;
      background: rgba(255, 255, 255, 0.97);
      border-radius: 1.25rem; padding: 1.75rem;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.1);
    `,
	});

	const title = createElement(
		"h3",
		{
			id: "settings-title",
			style:
				"font-size: 1.375rem; font-weight: 600; letter-spacing: -0.02em; color: #171717; margin-bottom: 0.5rem;",
		},
		"Settings"
	);
	modal.appendChild(title);

	if (options.reason) {
		modal.appendChild(
			createElement(
				"p",
				{
					style:
						"font-size: 0.875rem; color: #b45309; background: #fef3c7; border-radius: 0.5rem; padding: 0.5rem 0.75rem; margin-bottom: 1rem;",
				},
				options.reason
			)
		);
	}

	const label = createElement(
		"label",
		{
			for: "mw-api-key",
			style:
				"display: block; font-size: 0.875rem; font-weight: 500; color: #404040; margin-bottom: 0.375rem;",
		},
		"Merriam-Webster API key"
	);
	modal.appendChild(label);

	const input = createElement("input", {
		id: "mw-api-key",
		type: "password",
		className: "input-field",
		autocomplete: "off",
		spellcheck: "false",
		placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
		style: "width: 100%; font-family: ui-monospace, monospace; font-size: 0.875rem;",
	});
	input.value = getApiKey();
	modal.appendChild(input);

	const showRow = createElement("label", {
		style:
			"display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: #525252; margin-top: 0.5rem; cursor: pointer;",
	});
	const showBox = createElement("input", {
		type: "checkbox",
		onChange: () => {
			input.type = showBox.checked ? "text" : "password";
		},
	});
	showRow.appendChild(showBox);
	showRow.appendChild(document.createTextNode("Show key"));
	modal.appendChild(showRow);

	const help = createElement("p", {
		style:
			"font-size: 0.8125rem; color: #737373; line-height: 1.5; margin: 0.875rem 0 1.25rem;",
	});
	help.innerHTML = `Used to look up word definitions. Get a free key for the
    <strong>Collegiate Dictionary</strong> at
    <a href="https://dictionaryapi.com/register/index" target="_blank" rel="noopener" style="color: #2563eb; text-decoration: underline;">dictionaryapi.com</a>.
    The key is stored only in this browser.`;
	modal.appendChild(help);

	const buttons = createElement("div", {
		style: "display: flex; gap: 0.75rem;",
	});

	const clearBtn = createElement(
		"button",
		{
			className: "btn-secondary",
			style: "flex: 1;",
			onClick: () => {
				hapticFeedback("light");
				setApiKey("");
				input.value = "";
				showToast("API key removed");
			},
		},
		"Remove"
	);

	const saveBtn = createElement(
		"button",
		{
			className: "btn-primary",
			style: "flex: 1;",
			onClick: save,
		},
		"Save"
	);

	function save() {
		hapticFeedback("medium");
		try {
			setApiKey(input.value);
			showToast(input.value.trim() ? "API key saved" : "API key removed", "success");
			close();
		} catch (err) {
			console.error("Failed to save API key:", err);
			showToast("Could not save the key in this browser", "error");
		}
	}

	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") save();
	});

	buttons.appendChild(clearBtn);
	buttons.appendChild(saveBtn);
	modal.appendChild(buttons);

	overlay.appendChild(modal);
	document.body.appendChild(overlay);
	document.addEventListener("keydown", onKey);
	openOverlay = overlay;
	setTimeout(() => input.focus(), 50);
}
