/**
 * Seed Story Puzzles
 * Run: node scripts/seedStoryPuzzles.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const StoryPuzzle = require("../models/storyPuzzle");

const puzzles = [
  {
    prophetName: "Prophet Nuh (AS)",
    prophetNameMl: "നബി നൂഹ് (AS)",
    icon: "🚢",
    difficulty: "easy",
    description: "The Prophet of patience who built the great Ark",
    moral: "Patience and obedience to Allah saves us",
    color: "from-blue-400 to-blue-600",
    events: [
      { order: 1, text: "🌟 Allah chose Nuh (AS) as a Prophet and commanded him to guide his people." },
      { order: 2, text: "📢 Nuh (AS) preached to his people for 950 years, asking them to worship only Allah." },
      { order: 3, text: "😔 Most people refused to listen and mocked him, but a small group believed." },
      { order: 4, text: "🌊 Allah told Nuh (AS) that a great flood was coming as punishment for the disbelievers." },
      { order: 5, text: "🪵 Allah commanded Nuh (AS) to build a huge Ark (ship), even though there was no sea nearby." },
      { order: 6, text: "🐘 Nuh (AS) loaded the Ark with believers and a pair of every animal." },
      { order: 7, text: "🌧️ The flood came and covered the whole earth, but the Ark and its passengers were safe." },
      { order: 8, text: "🏔️ After the flood, the Ark rested on Mount Judi and everyone came out safely." },
    ],
  },
  {
    prophetName: "Prophet Ibrahim (AS)",
    prophetNameMl: "നബി ഇബ്രാഹിം (AS)",
    icon: "🔥",
    difficulty: "easy",
    description: "The father of Prophets — friend of Allah",
    moral: "True faith means trusting Allah even in the hardest tests",
    color: "from-orange-400 to-red-500",
    events: [
      { order: 1, text: "⭐ Ibrahim (AS) was born in Babylon (Iraq) and grew up among idol worshippers." },
      { order: 2, text: "🤔 As a young man, Ibrahim (AS) questioned: why do people worship stars, moon, and idols?" },
      { order: 3, text: "🗿 Ibrahim (AS) broke the idols in the temple to show they have no power." },
      { order: 4, text: "🔥 The king Nimrod ordered Ibrahim (AS) to be thrown into a massive fire." },
      { order: 5, text: "❄️ Allah commanded the fire: 'Be cool and safe for Ibrahim!' — and he was unharmed." },
      { order: 6, text: "🚶 Ibrahim (AS) migrated and traveled, spreading the message of One God." },
      { order: 7, text: "🌴 Ibrahim (AS) left his wife Hajar and baby Ismail in the desert of Makkah by Allah's command." },
      { order: 8, text: "🕋 Ibrahim and Ismail (AS) built the Kaaba — the house of Allah in Makkah." },
    ],
  },
  {
    prophetName: "Prophet Yusuf (AS)",
    prophetNameMl: "നബി യൂസുഫ് (AS)",
    icon: "👑",
    difficulty: "medium",
    description: "The Prophet with the most beautiful story in the Quran",
    moral: "Patience, forgiveness and trust in Allah always win",
    color: "from-yellow-400 to-amber-600",
    events: [
      { order: 1, text: "🌙 Young Yusuf (AS) saw a dream: 11 stars, the sun and moon bowing to him." },
      { order: 2, text: "😤 His brothers were jealous of the love their father Yaqub (AS) had for Yusuf." },
      { order: 3, text: "🕳️ The brothers threw Yusuf (AS) into a deep well and lied to their father that a wolf ate him." },
      { order: 4, text: "🐪 A caravan found Yusuf (AS) and sold him as a slave in Egypt." },
      { order: 5, text: "🏛️ Yusuf (AS) was falsely accused and imprisoned, but he remained patient and faithful." },
      { order: 6, text: "😴 The king of Egypt had a strange dream that no one could explain." },
      { order: 7, text: "🌾 Yusuf (AS) interpreted the dream: 7 good years then 7 years of famine — the king was amazed." },
      { order: 8, text: "👑 The king made Yusuf (AS) minister of Egypt to manage food for the people." },
      { order: 9, text: "🤗 Yusuf's brothers came to Egypt for food — he forgave them and the family was reunited." },
    ],
  },
  {
    prophetName: "Prophet Musa (AS)",
    prophetNameMl: "നബി മൂസ (AS)",
    icon: "⚡",
    difficulty: "medium",
    description: "The Prophet who spoke directly with Allah",
    moral: "Never fear anyone except Allah — truth always overcomes falsehood",
    color: "from-teal-400 to-cyan-600",
    events: [
      { order: 1, text: "👶 Musa (AS) was born when Pharaoh was killing all baby boys of Bani Israel." },
      { order: 2, text: "🌊 Allah inspired his mother to place baby Musa in a basket in the River Nile." },
      { order: 3, text: "🏰 The basket was found by Pharaoh's family and he was raised in the palace." },
      { order: 4, text: "🔥 While traveling, Musa (AS) saw a burning bush and heard Allah speaking to him." },
      { order: 5, text: "🐍 Allah gave Musa (AS) two miracles: his staff turning into a snake, and his glowing hand." },
      { order: 6, text: "👑 Musa (AS) went to Pharaoh and said: 'Let the Children of Israel go free!'" },
      { order: 7, text: "🪄 Musa (AS) defeated Pharaoh's magicians — they accepted Islam immediately." },
      { order: 8, text: "🌊 Musa (AS) struck the sea with his staff — the sea split into a path for Bani Israel to cross." },
      { order: 9, text: "💀 Pharaoh chased them but was drowned — Allah saved Bani Israel." },
      { order: 10, text: "⛰️ Musa (AS) received the Torah and the 10 Commandments from Allah on Mount Sinai." },
    ],
  },
  {
    prophetName: "Prophet Muhammad ﷺ",
    prophetNameMl: "നബി മുഹമ്മദ് ﷺ",
    icon: "🌙",
    difficulty: "hard",
    description: "The last and final Prophet — mercy to all mankind",
    moral: "The best character, kindness and truthfulness is the way of the Prophet ﷺ",
    color: "from-purple-500 to-indigo-600",
    events: [
      { order: 1, text: "🌟 Muhammad ﷺ was born in Makkah in the Year of the Elephant (570 CE)." },
      { order: 2, text: "📜 He was known as Al-Amin (The Trustworthy) before prophethood — loved by all." },
      { order: 3, text: "🏔️ At age 40, while meditating in Cave Hira, Angel Jibreel brought the first revelation: 'Iqra!' (Read)." },
      { order: 4, text: "📢 He began preaching Islam secretly, then publicly — Khadijah (RA) was the first to believe." },
      { order: 5, text: "😢 The Quraish persecuted Muslims — they were tortured, boycotted, and harmed." },
      { order: 6, text: "🌃 The miraculous Night Journey (Isra & Miraj) — he traveled to Jerusalem and the heavens." },
      { order: 7, text: "🚶 The Hijrah — migration from Makkah to Madinah, marking the start of the Islamic calendar." },
      { order: 8, text: "⚔️ The Battle of Badr — 313 believers defeated 1000 enemy soldiers with Allah's help." },
      { order: 9, text: "🕋 The Conquest of Makkah — he entered with mercy, forgiving his enemies." },
      { order: 10, text: "📿 The Farewell Sermon — his final speech to humanity about equality, rights and Islam." },
      { order: 11, text: "🌹 Prophet Muhammad ﷺ passed away at age 63, leaving the Quran and Sunnah for us." },
    ],
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  for (const data of puzzles) {
    const exists = await StoryPuzzle.findOne({ prophetName: data.prophetName });
    if (exists) {
      console.log(`⚠️  Already exists: ${data.prophetName}`);
    } else {
      await StoryPuzzle.create(data);
      console.log(`✅ Seeded: ${data.prophetName}`);
    }
  }

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => { console.error(err); process.exit(1); });
