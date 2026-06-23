'use strict';

const dayjs = require('dayjs');

const CHANNELS = ['新闻', '微博', '抖音', '快手', '小红书', '主流媒体'];

const KEYWORDS = ['星巴克', '蔚来', '咖啡', '新能源', '充电', '门店', '服务'];

const AUTHORS = {
  '新闻': ['新华财经', '人民日报', '经济观察报', '第一财经', '证券时报', '界面新闻'],
  '微博': ['科技观察员', '汽车达人小李', '消费者投诉站', '品牌追踪者', '财经八卦局', '热点播报'],
  '抖音': ['车圈测评官', '咖啡生活家', '消费日记', '品质生活vlog', '都市白领日常', '科技前沿速报'],
  '快手': ['农村来的小张', '二哥说车', '奥莱买手', '实惠生活记录', '小镇青年消费观', '乡村振兴达人'],
  '小红书': ['精致生活研究所', '咖啡控日记', '新能源车主说', '好物分享姐', '品牌体验官', '时尚消费博主'],
  '主流媒体': ['腾讯科技', '网易财经', '搜狐汽车', '凤凰财经', '新浪科技', '澎湃新闻']
};

const POSITIVE_TEMPLATES = [
  '{brand}最新款真的太香了，服务态度非常好，下次还会来！',
  '今天去了{brand}，体验感拉满，强烈推荐给大家！',
  '{brand}的产品质量越来越好，这次购买完全满意。',
  '用了{brand}这么久，从来没让我失望过，继续支持！',
  '{brand}这次活动力度很大，粉丝福利满满，点赞！',
  '朋友推荐了{brand}，果然名不虚传，体验超出预期。',
  '{brand}的客服响应速度很快，问题当天就解决了，五星好评！',
  '刚刚体验了{brand}的新服务，细节做得很到位，值得信赖。',
  '{brand}在行业里算是良心品牌了，价格透明，品质稳定。',
  '这次{brand}的限定款真的绝了，排了两小时队买到了，超值！',
];

const NEGATIVE_TEMPLATES = [
  '{brand}这次真的让我很失望，售后推诿扯皮，体验极差。',
  '投诉{brand}一周了没有回音，这服务态度太差了！',
  '{brand}最近产品质量下滑严重，价格倒是没降，不值。',
  '去{brand}排了半小时队，服务员态度冷漠，下次不来了。',
  '{brand}的App经常崩溃，用户体验太糟糕，建议整改。',
  '买了{brand}的东西，收到货跟图片差距太大，明显虚假宣传。',
  '{brand}涨价了但质量却没跟上，性价比大幅下降，失望。',
  '这已经是第三次{brand}出问题了，品控到底在做什么？',
  '{brand}客服态度恶劣，完全不解决问题，真的很气愤。',
  '{brand}最近负面新闻不断，感觉品牌形象在走下坡路。',
];

const NEUTRAL_TEMPLATES = [
  '{brand}近期发布了新款产品，具体体验有待市场检验。',
  '关于{brand}的最新动态，目前业内反应较为平淡。',
  '{brand}宣布进军新市场，战略意图明显，效果尚不明确。',
  '分析人士对{brand}今年的业绩预期持中性观点。',
  '{brand}本季度营收数据已出炉，整体符合市场预期。',
  '有消费者表示{brand}产品中规中矩，没有特别惊喜也没有失望。',
  '{brand}正在调整渠道策略，具体方向还在观望中。',
  '行业报告显示{brand}市占率保持稳定，未见明显波动。',
  '{brand}的最新款上市，市场反应尚待观察。',
  '针对{brand}的报道，各方评价不一，消费者意见分歧。',
];

const STARBUCKS_SPECIFICS = {
  positive: [
    '星巴克的冰美式今天加了燕麦奶，口感升级了，真的好喝！',
    '星巴克会员活动来了，买二送一，已经囤了三杯了，开心！',
    '第一次去星巴克臻选店，氛围感拉满，咖啡现萃的感觉不一样。',
    '星巴克APP改版了，点单更方便了，积星送饮料活动也很良心。',
    '星巴克新出的桂花拿铁是真的香，秋天限定值得等！',
  ],
  negative: [
    '星巴克中杯价格又涨了，38块一杯的中杯，喝不起喝不起。',
    '星巴克门店清洁卫生问题被曝光，选料不新鲜，拉低了品牌形象。',
    '星巴克在中国区涨价，同款比美国贵了30%，为什么要这样？',
    '等了20分钟的星巴克外卖，到手是冷的，还洒了，差评。',
    '星巴克承认部分门店使用过期食材，事件持续发酵，监管需加强。',
  ],
  neutral: [
    '星巴克公布Q3财报，中国区同店销售额同比小幅下滑，市场关注。',
    '星巴克宣布与本土品牌合作推联名款，具体效果待市场验证。',
    '星巴克在下沉市场加速开店，与本土咖啡品牌竞争态势明显。',
  ],
};

const NIO_SPECIFICS = {
  positive: [
    '蔚来换电模式真的方便，不用担心里程焦虑，出行体验大幅提升。',
    '蔚来的用户服务体系在行业里是天花板级别的，NIO House体验很棒。',
    '刚提了蔚来ET7，外观内饰都惊艳，智能驾驶辅助系统很成熟。',
    '蔚来这次发布了BaaS换电方案，降低了购车门槛，挺有竞争力的。',
    '蔚来用户社区氛围非常好，车主互助文化是其他品牌学不来的。',
  ],
  negative: [
    '蔚来频繁召回，这批次质量问题到底什么时候能彻底解决？',
    '蔚来价格高企，同配置比BBA还贵，溢价是不是太离谱了？',
    '蔚来换电站布局在三四线城市太少了，出远门依然很焦虑。',
    '蔚来APP推送太频繁了，各种活动消息把手机刷屏了，体验差。',
    '蔚来这季度交付量下滑，面临价格战压力，前景不乐观。',
  ],
  neutral: [
    '蔚来发布第二品牌乐道，定价策略走亲民路线，市场反应待观察。',
    '蔚来与长安、吉利达成换电合作，生态扩展意图明显。',
    '蔚来Q2交付数据出炉，同环比均有一定增幅，符合预期。',
  ],
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMentions() {
  const mentions = [];
  let id = 1;
  const now = dayjs();

  const brandSets = [
    { brand: '星巴克', keywords: ['星巴克', '咖啡', '门店', '服务'], specifics: STARBUCKS_SPECIFICS },
    { brand: '蔚来', keywords: ['蔚来', '新能源', '充电', '服务'], specifics: NIO_SPECIFICS },
  ];

  // Generate 160 brand-specific mentions (80 per brand)
  for (const { brand, keywords: brandKeywords, specifics } of brandSets) {
    const distributions = [
      { sentiment: 'positive', templates: specifics.positive, count: 32 },
      { sentiment: 'negative', templates: specifics.negative, count: 28 },
      { sentiment: 'neutral', templates: specifics.neutral, count: 20 },
    ];

    for (const { sentiment, templates, count } of distributions) {
      for (let i = 0; i < count; i++) {
        const daysAgo = randomInt(0, 29);
        const hoursAgo = randomInt(0, 23);
        const channel = randomElement(CHANNELS);
        const authors = AUTHORS[channel];
        const contentTemplate = randomElement(templates);
        const content = contentTemplate.replace(/{brand}/g, brand);
        const usedKeywords = [brand, ...brandKeywords.filter(() => Math.random() > 0.5)];

        mentions.push({
          id: String(id++),
          channel,
          author: randomElement(authors),
          posted_at: now.subtract(daysAgo, 'day').subtract(hoursAgo, 'hour').toISOString(),
          content,
          url: `https://example.com/${channel}/${id}`,
          sentiment,
          keywords: [...new Set(usedKeywords)],
        });
      }
    }
  }

  // Generate 150 generic template mentions with various keywords
  const genericSentiments = [
    { sentiment: 'positive', templates: POSITIVE_TEMPLATES, count: 60 },
    { sentiment: 'negative', templates: NEGATIVE_TEMPLATES, count: 50 },
    { sentiment: 'neutral', templates: NEUTRAL_TEMPLATES, count: 40 },
  ];

  const genericBrands = ['星巴克', '蔚来'];

  for (const { sentiment, templates, count } of genericSentiments) {
    for (let i = 0; i < count; i++) {
      const daysAgo = randomInt(0, 29);
      const hoursAgo = randomInt(0, 23);
      const channel = randomElement(CHANNELS);
      const authors = AUTHORS[channel];
      const brand = randomElement(genericBrands);
      const contentTemplate = randomElement(templates);
      const content = contentTemplate.replace(/{brand}/g, brand);
      const numKeywords = randomInt(1, 3);
      const usedKeywords = [brand];
      while (usedKeywords.length < numKeywords + 1) {
        const kw = randomElement(KEYWORDS);
        if (!usedKeywords.includes(kw)) usedKeywords.push(kw);
      }

      mentions.push({
        id: String(id++),
        channel,
        author: randomElement(authors),
        posted_at: now.subtract(daysAgo, 'day').subtract(hoursAgo, 'hour').toISOString(),
        content,
        url: `https://example.com/${channel}/${id}`,
        sentiment,
        keywords: usedKeywords,
      });
    }
  }

  // Shuffle
  for (let i = mentions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mentions[i], mentions[j]] = [mentions[j], mentions[i]];
  }

  return mentions;
}

let _mentions = null;

function getMentions() {
  if (!_mentions) {
    _mentions = generateMentions();
  }
  return _mentions;
}

module.exports = { getMentions, KEYWORDS, CHANNELS };
