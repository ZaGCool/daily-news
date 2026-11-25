import Parser from "rss-parser";

// 可在这里继续添加或修改新闻源。
// name 用于摘要中的来源名称，url 用于读取 RSS 或 Atom 数据。
export const RSS_FEEDS = [
  {
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
  },
  {
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
  },
  {
    name: "Ars Technica",
    url: "https://feeds.arstechnica.com/arstechnica/index",
  },
  {
    name: "Wired",
    url: "https://www.wired.com/feed/rss",
  },
] as const;

export type RssSource = (typeof RSS_FEEDS)[number];

// 处理和展示新闻时使用统一的数据结构。
export type DailyNewsItem = {
  title: string;
  link: string;
  description: string;
  source: string;
  publishedAt: Date;
  publishedAtText: string;
  contentSnippet: string;
  importanceScore: number;
};

export type DailyDigest = {
  summary: string;
  html: string;
};

const parser = new Parser({
  timeout: 10_000,
  headers: {
    "User-Agent": "Daily-News-RSS-Bot/1.0",
  },
});

// 抓取并解析单个 RSS 源。
export async function fetchNewsFromFeed(source: RssSource) {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "Daily-News-RSS-Bot/1.0",
      Accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
    // 让抓取失败后的缓存行为更可预测。
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`无法读取 ${source.name}: HTTP ${response.status}`);
  }

  const xml = await response.text();
  const feed = await parser.parseString(xml);

  return feed.items.map((item): DailyNewsItem => {
    const title = item.title?.trim() || "（无标题）";
    const link = item.link?.trim() || "";
    const description =
      item.contentSnippet?.trim() ||
      item.summary?.trim() ||
      item.content
        ?.replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim() ||
      "";

    const publishedAt = item.isoDate
      ? new Date(item.isoDate)
      : item.pubDate
        ? new Date(item.pubDate)
        : new Date(0);

    const safePublishedAt = Number.isNaN(publishedAt.getTime())
      ? new Date(0)
      : publishedAt;

    return {
      title,
      link,
      description,
      source: source.name,
      publishedAt: safePublishedAt,
      publishedAtText: formatDateTime(safePublishedAt),
      contentSnippet: truncate(stripHtml(description), 220),
      importanceScore: 0,
    };
  });
}

// 并行抓取所有 RSS 源；某一个源失败时不影响其他源。
export async function fetchNewsFromAllFeeds(
  sources: readonly RssSource[] = RSS_FEEDS,
) {
  const results = await Promise.allSettled(
    sources.map((source) => fetchNewsFromFeed(source)),
  );

  const news: DailyNewsItem[] = [];
  const failedSources: string[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      news.push(...result.value);
    } else {
      failedSources.push(sources[index].name);
    }
  });

  return {
    news: arrangeNews(news),
    failedSources,
  };
}

// 去重、按发布时间倒序整理，并计算每条新闻的简单重要性分数。
export function arrangeNews(news: DailyNewsItem[]) {
  const seen = new Set<string>();

  return news
    .filter((item) => {
      const key = item.link
        ? `link:${item.link}`
        : `title:${item.title.toLowerCase()}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .map((item) => ({
      ...item,
      importanceScore: calculateImportanceScore(item),
    }))
    .sort((first, second) => {
      // 优先按重要性排序，方便选择前 15 条；时间仍作为同分时的次要依据。
      if (second.importanceScore !== first.importanceScore) {
        return second.importanceScore - first.importanceScore;
      }

      return second.publishedAt.getTime() - first.publishedAt.getTime();
    });
}

// 选出前 limit 条，并在筛选前按综合分数重新整理。
export function selectTopNews(news: DailyNewsItem[], limit = 15) {
  const safeLimit = Math.max(0, limit);
  return arrangeNews(news).slice(0, safeLimit);
}

// 按新闻来源分组，来源内仍按发布时间倒序排列。
export function groupNewsBySource(news: DailyNewsItem[]) {
  const grouped = new Map<string, DailyNewsItem[]>();

  for (const item of news) {
    const sourceItems = grouped.get(item.source) || [];
    sourceItems.push(item);
    grouped.set(item.source, sourceItems);
  }

  return Array.from(grouped.entries()).map(([source, items]) => ({
    source,
    items: [...items].sort(
      (first, second) =>
        second.publishedAt.getTime() - first.publishedAt.getTime(),
    ),
  }));
}

// 生成纯文本版每日摘要。
export function generateTextSummary(news: DailyNewsItem[]) {
  const date = formatDate(new Date());
  const groups = groupNewsBySource(news);

  const lines = [
    `今日科技新闻摘要 · ${date}`,
    `共整理 ${news.length} 条重点新闻`,
    "",
  ];

  if (groups.length === 0) {
    lines.push("今日暂时没有获取到可用新闻。");
    return lines.join("\n");
  }

  groups.forEach((group, groupIndex) => {
    lines.push(`${groupIndex + 1}. ${group.source}`);

    group.items.forEach((item, itemIndex) => {
      lines.push(`   ${itemIndex + 1}) ${item.title}`);
      lines.push(`      发布时间：${item.publishedAtText}`);

      if (item.contentSnippet) {
        lines.push(`      摘要：${item.contentSnippet}`);
      }

      if (item.link) {
        lines.push(`      链接：${item.link}`);
      }

      lines.push("");
    });
  });

  return lines.join("\n").trim();
}

// 生成可直接用于邮件或页面展示的 HTML 摘要。
export function generateHtmlSummary(news: DailyNewsItem[]) {
  const date = formatDate(new Date());
  const groups = groupNewsBySource(news);

  if (groups.length === 0) {
    return `
      <section>
        <h1>今日科技新闻摘要 · ${escapeHtml(date)}</h1>
        <p>今日暂时没有获取到可用新闻。</p>
      </section>
    `.trim();
  }

  const groupedHtml = groups
    .map((group) => {
      const itemsHtml = group.items
        .map((item) => {
          const title = escapeHtml(item.title);
          const snippet = escapeHtml(item.contentSnippet);
          const sourceTime = escapeHtml(item.publishedAtText);
          const link = item.link ? escapeHtml(item.link) : "";

          return `
            <article style="margin:0 0 18px 0">
              <h3 style="margin:0 0 6px 0;font-size:16px">
                ${link ? `<a href="${link}" style="color:#111827;text-decoration:none">${title}</a>` : title}
              </h3>
              ${snippet ? `<p style="margin:0 0 6px 0;color:#4b5563">${snippet}</p>` : ""}
              <p style="margin:0;color:#6b7280;font-size:12px">发布时间：${sourceTime}</p>
            </article>
          `.trim();
        })
        .join("");

      return `
        <section style="margin:24px 0">
          <h2 style="border-bottom:1px solid #e5e7eb;padding-bottom:8px">${escapeHtml(group.source)}</h2>
          ${itemsHtml}
        </section>
      `.trim();
    })
    .join("");

  return `
    <main style="max-width:760px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827">
      <h1>今日科技新闻摘要 · ${escapeHtml(date)}</h1>
      <p style="color:#6b7280">共整理 ${news.length} 条重点新闻</p>
      ${groupedHtml}
    </main>
  `.trim();
}

// 一键获取、整理、筛选并生成每日摘要。
export async function generateDailyDigest(limit = 15): Promise<DailyDigest> {
  const { news } = await fetchNewsFromAllFeeds();
  const topNews = selectTopNews(news, limit);

  return {
    summary: generateTextSummary(topNews),
    html: generateHtmlSummary(topNews),
  };
}

// 使用最近发布时间和标题关键词，给新闻估算一个简单的重要性分数。
function calculateImportanceScore(item: DailyNewsItem) {
  const now = Date.now();
  const ageInHours = Math.max(
    0,
    (now - item.publishedAt.getTime()) / (1000 * 60 * 60),
  );

  // 24 小时内的新闻获得最高时效加分；越旧，加分越少。
  const freshnessScore =
    item.publishedAt.getTime() > 0 ? Math.max(0, 100 - ageInHours) : 0;

  const text = `${item.title} ${item.contentSnippet}`.toLowerCase();
  const importantKeywords = [
    "breaking",
    "launch",
    "announce",
    "acquires",
    "acquisition",
    "funding",
    "raises",
    "ipo",
    "ai",
    "openai",
    "google",
    "apple",
    "microsoft",
    "nvidia",
    "security",
    "breach",
  ];

  const keywordScore = importantKeywords.reduce(
    (score, keyword) => score + (text.includes(keyword) ? 8 : 0),
    0,
  );

  return freshnessScore + keywordScore;
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, length: number) {
  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, length - 1).trim()}…`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDateTime(date: Date) {
  if (date.getTime() === 0) {
    return "发布时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
