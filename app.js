import { analyzeText } from "./engine/analyzer.js";

const Home = {
  template: `
    <div class="card">
      <h2>感情分析エンジン</h2>

      <textarea v-model="text" rows="4" placeholder="テキストを入力..."></textarea>

      <button @click="analyze">分析</button>
	<div v-if="matchedWords.length" class="stats">
	  <p>ヒット単語:</p>
	  <ul>
	    <li v-for="(m, index) in matchedWords" :key="index">
	      {{ m.word }}（{{ m.category }} / {{ m.polarity }}）
	    </li>
	  </ul>
	</div>
      <div v-if="result" :class="['result', resultClass]">
        {{ result }}
      </div>

      <div class="stats" v-if="result">
        スコア: {{ score }} / ヒット: {{ hits }}
      </div>
    </div>
  `,
  data() {
    return {
      text: "",
      result: "",
      score: 0,
      hits: 0,
      matchedWords: [], 
      categoryScore: {},
      config: null
    };
  },
  computed: {
    resultClass() {
      if (this.result === "ポジティブ") return "positive";
      if (this.result === "ネガティブ") return "negative";
      return "neutral";
    }
  },
  async mounted() {
    const res = await fetch("./data/config.json");
    this.config = await res.json();
  },
  methods: {
    analyze() {
      if (!this.config) return;

      const r = analyzeText(this.text, this.config);

      this.result = r.result;
      this.score = r.score;
      this.hits = r.hits;
      this.matchedWords = r.matchedWords;
      this.categoryScore = r.categoryScore;
	}
  }
};

// Router
const routes = [
  { path: "/", component: Home }
];

const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes
});

const app = Vue.createApp({});
app.use(router);
app.mount("#app");
