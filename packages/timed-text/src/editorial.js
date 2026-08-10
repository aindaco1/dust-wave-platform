const MAXIMUM_WORDS = 500_000;
const MAXIMUM_WORD_LENGTH = 240;
const CONTROL_OR_BIDI =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
const WORD_PARTS = /^([("'“‘\[]*)([A-Za-z]+)([.,!?;:"'’”\)\]]*)$/u;
const SENTENCE_END = /[.!?]["'’”\)\]]*$/u;
const CONTENT = /[\p{L}\p{N}]/u;
const LETTER = /\p{L}/u;

const ONES = Object.freeze({
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9
});
const TEENS = Object.freeze({
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19
});
const TENS = Object.freeze({
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90
});

export const ENGLISH_EDITORIAL_NORMALIZATION_POLICY =
  "english-editorial-normalization-v1";

export function normalizeEnglishEditorialWords(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAXIMUM_WORDS) {
    throw new TypeError("English editorial words are invalid");
  }
  const words = value.map((word, index) => safeWord(word, index));
  const collapsed = [];
  for (let index = 0; index < words.length;) {
    const year = yearAt(words, index);
    if (year) {
      collapsed.push({
        text: year.text,
        sourceStartIndex: index,
        sourceEndIndex: index + year.length - 1
      });
      index += year.length;
    } else {
      collapsed.push({
        text: words[index],
        sourceStartIndex: index,
        sourceEndIndex: index
      });
      index += 1;
    }
  }

  let sentenceStart = true;
  return collapsed.map((word) => {
    let text = normalizeFirstPersonPronoun(word.text);
    if (sentenceStart) text = uppercaseFirstLetter(text);
    if (CONTENT.test(text)) sentenceStart = false;
    if (SENTENCE_END.test(text)) sentenceStart = true;
    return { ...word, text };
  });
}

function safeWord(value, index) {
  if (typeof value !== "string" || CONTROL_OR_BIDI.test(value)) {
    throw new TypeError(`English editorial word ${index + 1} is invalid`);
  }
  const text = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!text || [...text].length > MAXIMUM_WORD_LENGTH) {
    throw new TypeError(`English editorial word ${index + 1} is invalid`);
  }
  return text;
}

function yearAt(words, index) {
  const first = wordParts(words[index]);
  if (!first) return null;

  if (first.core === "two" && !first.suffix) {
    const thousand = wordParts(words[index + 1]);
    if (thousand?.core === "thousand" && !thousand.prefix) {
      if (thousand.suffix) {
        return yearResult(first.prefix, 2000, thousand.suffix, 2);
      }
      let tailIndex = index + 2;
      const conjunction = wordParts(words[tailIndex]);
      if (conjunction?.core === "and" && !conjunction.prefix && !conjunction.suffix) {
        tailIndex += 1;
      }
      const tail = underHundredAt(words, tailIndex);
      if (tail) {
        return yearResult(
          first.prefix,
          2000 + tail.value,
          tail.suffix,
          tailIndex - index + tail.length
        );
      }
      return yearResult(first.prefix, 2000, "", 2);
    }
  }

  const century = first.core === "nineteen"
    ? 1900
    : first.core === "twenty" ? 2000 : null;
  if (century === null || first.suffix) return null;
  const next = wordParts(words[index + 1]);
  if (next?.core === "hundred" && !next.prefix) {
    return yearResult(first.prefix, century, next.suffix, 2);
  }
  const tail = underHundredAt(words, index + 1);
  if (!tail || (century === 2000 && tail.value < 10 && tail.kind !== "oh")) {
    return null;
  }
  return yearResult(first.prefix, century + tail.value, tail.suffix, 1 + tail.length);
}

function underHundredAt(words, index) {
  const first = wordParts(words[index]);
  if (!first || first.prefix) return null;
  if (first.core === "oh" && !first.suffix) {
    const second = wordParts(words[index + 1]);
    const value = second && !second.prefix ? ONES[second.core] : undefined;
    if (value !== undefined && value > 0) {
      return { value, length: 2, suffix: second.suffix, kind: "oh" };
    }
    return null;
  }
  if (Object.hasOwn(TEENS, first.core)) {
    return {
      value: TEENS[first.core], length: 1, suffix: first.suffix, kind: "number"
    };
  }
  if (Object.hasOwn(TENS, first.core)) {
    if (!first.suffix) {
      const second = wordParts(words[index + 1]);
      const ones = second && !second.prefix ? ONES[second.core] : undefined;
      if (ones !== undefined && ones > 0) {
        return {
          value: TENS[first.core] + ones,
          length: 2,
          suffix: second.suffix,
          kind: "number"
        };
      }
    }
    return {
      value: TENS[first.core], length: 1, suffix: first.suffix, kind: "number"
    };
  }
  if (Object.hasOwn(ONES, first.core)) {
    return {
      value: ONES[first.core], length: 1, suffix: first.suffix, kind: "number"
    };
  }
  return null;
}

function wordParts(value) {
  if (typeof value !== "string") return null;
  const match = WORD_PARTS.exec(value);
  if (!match) return null;
  return { prefix: match[1], core: match[2].toLowerCase(), suffix: match[3] };
}

function yearResult(prefix, value, suffix, length) {
  if (!Number.isSafeInteger(value) || value < 1900 || value > 2099) return null;
  return { text: `${prefix}${value}${suffix}`, length };
}

function normalizeFirstPersonPronoun(value) {
  const match = /^([("'“‘\[]*)i((?:['’](?:m|d|ll|ve))?)([.,!?;:"'’”\)\]]*)$/iu.exec(value);
  if (!match) return value;
  const contraction = match[2]
    ? `${match[2][0]}${match[2].slice(1).toLowerCase()}`
    : "";
  return `${match[1]}I${contraction}${match[3]}`;
}

function uppercaseFirstLetter(value) {
  const characters = [...value];
  const letters = characters.filter((character) => LETTER.test(character));
  if (letters.some((character) => character !== character.toLocaleLowerCase("en-US"))) {
    return value;
  }
  const index = characters.findIndex((character) => LETTER.test(character));
  if (index < 0) return value;
  characters[index] = characters[index].toLocaleUpperCase("en-US");
  return characters.join("");
}
