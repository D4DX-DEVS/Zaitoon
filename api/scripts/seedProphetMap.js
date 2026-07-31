/**
 * Seed Prophet Map Data
 * Run: node scripts/seedProphetMap.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const ProphetMap = require("../models/prophetMap");
const MapQuizQuestion = require("../models/mapQuizQuestion");

const prophets = [
  {
    prophetName: "Prophet Adam (AS)", prophetNameMl: "നബി ആദം (AS)",
    icon: "🌿", mapX: 270, mapY: 130, region: "Levant / Earth", color: "#10b981",
    description: "The first human and first Prophet, created by Allah from clay. He and Hawwa (Eve) were placed on Earth after leaving Jannah.",
    miracle: "Allah taught Adam (AS) the names of all things — the first knowledge given to mankind.",
    quranReference: "'And He taught Adam the names of all things...' — Quran 2:31",
    location: "Jerusalem / Earth (Creation)",
  },
  {
    prophetName: "Prophet Ibrahim (AS)", prophetNameMl: "നബി ഇബ്രാഹിം (AS)",
    icon: "🔥", mapX: 283, mapY: 117, region: "Iraq → Makkah", color: "#f59e0b",
    description: "Born in Ur (modern Iraq), Ibrahim (AS) destroyed idols, survived fire, and traveled to Makkah where he built the Kaaba with his son Ismail.",
    miracle: "Allah commanded the fire to be cool and safe for Ibrahim — he walked out unharmed!",
    quranReference: "'Indeed, Ibrahim was a nation (in himself), devoutly obedient to Allah...' — Quran 16:120",
    location: "Babylon, Iraq → Makkah, Arabia",
  },
  {
    prophetName: "Prophet Musa (AS)", prophetNameMl: "നബി മൂസ (AS)",
    icon: "⚡", mapX: 218, mapY: 132, region: "Egypt → Sinai", color: "#0ea5e9",
    description: "Born in Egypt, Musa (AS) was raised in Pharaoh's palace, then chosen as Prophet. He freed Bani Israel from slavery and received the Torah.",
    miracle: "Splitting the Red Sea with his staff, 9 miracles against Pharaoh including the flood, locusts, and frogs.",
    quranReference: "'And We inspired Musa: strike the sea with your staff! It parted...' — Quran 26:63",
    location: "Egypt & Sinai Peninsula",
  },
  {
    prophetName: "Prophet Isa (AS)", prophetNameMl: "നബി ഈസ (AS)",
    icon: "✨", mapX: 252, mapY: 121, region: "Palestine", color: "#6366f1",
    description: "Born miraculously to Maryam (Mary) in Bethlehem, Palestine. He was sent to the Children of Israel with the Injeel (Gospel).",
    miracle: "Spoke as a baby in the cradle, healed the blind and sick, brought the dead back to life — all by Allah's permission.",
    quranReference: "'The Messiah, Isa son of Maryam, was a Messenger of Allah...' — Quran 4:171",
    location: "Palestine (Bethlehem & Jerusalem)",
  },
  {
    prophetName: "Prophet Muhammad ﷺ", prophetNameMl: "നബി മുഹമ്മദ് ﷺ",
    icon: "🌙", mapX: 268, mapY: 148, region: "Makkah → Madinah", color: "#7c3aed",
    description: "The last and final Prophet, born in Makkah. He received the Quran and spread Islam. He migrated to Madinah and united the Arabian Peninsula.",
    miracle: "The Quran — the eternal miracle. Also: Isra & Miraj (night journey to heavens), splitting of the moon.",
    quranReference: "'And We have not sent you except as mercy to all the worlds.' — Quran 21:107",
    location: "Makkah & Madinah, Arabia",
  },
  {
    prophetName: "Prophet Yusuf (AS)", prophetNameMl: "നബി യൂസുഫ് (AS)",
    icon: "👑", mapX: 220, mapY: 138, region: "Canaan → Egypt", color: "#f97316",
    description: "Son of Yaqub (AS), born in Canaan (Palestine/Jordan area). Sold into slavery, he rose to become Minister of Egypt, reuniting his family.",
    miracle: "Allah gave him the ability to interpret dreams — a gift that saved Egypt from famine.",
    quranReference: "'We narrate to you the best of stories in what We revealed to you...' — Quran 12:3",
    location: "Canaan (Palestine) → Egypt",
  },
  {
    prophetName: "Prophet Nuh (AS)", prophetNameMl: "നബി നൂഹ് (AS)",
    icon: "🚢", mapX: 285, mapY: 110, region: "Mesopotamia", color: "#3b82f6",
    description: "One of the greatest Prophets, sent to Mesopotamia (Iraq region). He preached for 950 years, built the Ark, and survived the Great Flood.",
    miracle: "The Great Ark that saved believers and animals from the flood that covered the whole earth.",
    quranReference: "'We sent Nuh to his people, and he remained among them 1000 less 50 years...' — Quran 29:14",
    location: "Mesopotamia (Iraq region)",
  },
  {
    prophetName: "Prophet Dawud (AS)", prophetNameMl: "നബി ദാവൂദ് (AS)",
    icon: "🎵", mapX: 253, mapY: 125, region: "Palestine", color: "#ec4899",
    description: "Also known as David, he was a king and Prophet in Jerusalem. Allah gave him a beautiful voice and the Psalms (Zabur).",
    miracle: "Mountains and birds would sing along with him! Allah softened iron for him to make armor.",
    quranReference: "'And We gave Dawud the Psalms (Zabur).' — Quran 17:55",
    location: "Jerusalem, Palestine",
  },
  {
    prophetName: "Prophet Sulayman (AS)", prophetNameMl: "നബി സുലൈമാൻ (AS)",
    icon: "👸", mapX: 254, mapY: 128, region: "Palestine", color: "#14b8a6",
    description: "Son of Dawud, a great king given immense wisdom. He could speak to animals and birds, and commanded the Jinn to build grand structures.",
    miracle: "Control over wind, Jinn, animals and birds. The Queen of Sheba (Bilqis) accepted Islam after his wisdom.",
    quranReference: "'And to Sulayman We subjected the wind — its morning was a month's journey...' — Quran 34:12",
    location: "Jerusalem, Palestine",
  },
  {
    prophetName: "Prophet Yunus (AS)", prophetNameMl: "നബി യൂനുസ് (AS)",
    icon: "🐋", mapX: 290, mapY: 112, region: "Nineveh, Iraq", color: "#8b5cf6",
    description: "Sent to the people of Nineveh (in modern Iraq). When he left without Allah's permission, he was swallowed by a whale, where he made dua.",
    miracle: "Survived 40 days inside a whale by continuously making dua — 'La ilaha illa anta subhanaka inni kuntu minaz-zalimin'",
    quranReference: "'And (remember) Yunus when he left in anger, thinking We would not restrict him...' — Quran 21:87",
    location: "Nineveh, Iraq (modern Mosul)",
  },
];

const questions = [
  {
    icon: "🚢",
    questionText: "Prophet Nuh (AS) built the Ark — where was he sent?",
    options: ["Egypt", "Iraq / Mesopotamia", "Arabia", "Palestine"],
    correctAnswer: 1,
    explanation: "Nuh (AS) was sent to the people of Mesopotamia (ancient Iraq region).",
  },
  {
    icon: "🔥",
    questionText: "Prophet Ibrahim (AS) was thrown into fire. In which city?",
    options: ["Cairo", "Jerusalem", "Babylon (Iraq)", "Makkah"],
    correctAnswer: 2,
    explanation: "Ibrahim (AS) was born and lived in Babylon, modern-day Iraq, before migrating.",
  },
  {
    icon: "⚡",
    questionText: "Prophet Musa (AS) split the sea. He was sent to which nation?",
    options: ["Arabia", "Palestine", "Babylon", "Egypt"],
    correctAnswer: 3,
    explanation: "Musa (AS) was born and raised in Egypt, and freed Bani Israel from Pharaoh.",
  },
  {
    icon: "👑",
    questionText: "Prophet Yusuf (AS) became Minister of which country?",
    options: ["Syria", "Egypt", "Jordan", "Iraq"],
    correctAnswer: 1,
    explanation: "Yusuf (AS) rose from slave to Minister of Egypt, saving it from famine.",
  },
  {
    icon: "🌙",
    questionText: "Prophet Muhammad ﷺ made Hijrah (migration) from Makkah to which city?",
    options: ["Cairo", "Baghdad", "Madinah", "Jerusalem"],
    correctAnswer: 2,
    explanation: "The Hijrah to Madinah in 622 CE marks the start of the Islamic calendar.",
  },
  {
    icon: "✨",
    questionText: "Prophet Isa (AS) was born in which city?",
    options: ["Makkah", "Cairo", "Babylon", "Bethlehem, Palestine"],
    correctAnswer: 3,
    explanation: "Isa (AS) was born miraculously in Bethlehem, Palestine.",
  },
  {
    icon: "🐋",
    questionText: "Prophet Yunus (AS) was swallowed by a whale near which region?",
    options: ["Red Sea", "Iraq (Nineveh)", "Egypt", "Arabia"],
    correctAnswer: 1,
    explanation: "Yunus (AS) was sent to Nineveh, near modern-day Mosul, Iraq.",
  },
  {
    icon: "🎵",
    questionText: "Prophet Dawud (AS) was a king in which holy city?",
    options: ["Makkah", "Madinah", "Jerusalem", "Baghdad"],
    correctAnswer: 2,
    explanation: "Dawud (AS) was king of the Israelites and ruled from Jerusalem (Bait ul Maqdis).",
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  for (const data of prophets) {
    const exists = await ProphetMap.findOne({ prophetName: data.prophetName });
    if (exists) {
      console.log(`⚠️  Prophet already exists: ${data.prophetName}`);
    } else {
      await ProphetMap.create(data);
      console.log(`✅ Seeded prophet: ${data.prophetName}`);
    }
  }

  for (const data of questions) {
    const exists = await MapQuizQuestion.findOne({ questionText: data.questionText });
    if (exists) {
      console.log(`⚠️  Question already exists: ${data.questionText.substring(0, 40)}...`);
    } else {
      await MapQuizQuestion.create(data);
      console.log(`✅ Seeded question: ${data.questionText.substring(0, 40)}...`);
    }
  }

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => { console.error(err); process.exit(1); });
