import { analyzeText } from "./engine/analyzer.js";

let config = {};

async function loadConfig() {
  const res = await fetch("./data/config.json");
  config = await res.json();
}

window.analyze = async function () {
  if (!config.words) {
    await loadConfig();
  }

  const text = document.getElementById("input").value;
  const result = analyzeText(text, config);

  document.getElementById("result").innerText =
    `結果: ${result.result} (score=${result.score}, hits=${result.hits})`;
};
