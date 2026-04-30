import { analyzeText } from "./engine/analyzer.js";

const Home = {
  template: `
    <div>
      <textarea v-model="text" rows="4" cols="50"></textarea><br>
      <button @click="analyze">分析</button>

      <p>結果: {{ result }}</p>
      <p>スコア: {{ score }}</p>
      <p>ヒット数: {{ hits }}</p>
    </div>
  `,
  data() {
    return {
      text: "",
      result: "",
      score: 0,
      hits: 0,
      config: null
    };
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
    }
  }
};

// ルーター
const routes = [
  { path: "/", component: Home }
];

const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes
});

// アプリ作成
const app = Vue.createApp({});
app.use(router);
app.mount("#app");
