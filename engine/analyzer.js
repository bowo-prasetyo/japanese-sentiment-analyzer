let config = {};

async function loadConfig() {
  const res = await fetch("config.json");
  config = await res.json();
}

function analyze() {
  const text = document.getElementById("input").value;

  let score = 0;
  let hits = 0;

  for (let category in config.words) {
    const words = config.words[category];

    for (let word of words) {
      if (text.includes(word)) {
        const polarity = config.polarity[category] || 0;
        score += polarity;
        hits++;
      }
    }
  }

  let result = "中立";

  if (hits === 0) result = "判定不能";
  else if (score > 0) result = "ポジティブ";
  else if (score < 0) result = "ネガティブ";

  document.getElementById("result").innerText =
    `結果: ${result} (score=${score})`;
}
