import { PARSE_REGEX } from './regex.js';
import { ParsedFile } from '../db/schemas.js';
import { Parser, handlers } from '@viren070/parse-torrent-title';
import { FULL_LANGUAGE_MAPPING } from '../utils/languages.js';
import { LANGUAGES } from '../utils/constants.js';

function matchPattern(
  filename: string,
  patterns: Record<string, RegExp>
): string | undefined {
  // For resolutions, prefer explicit patterns (1080p, 2160p, etc.) over generic ones (UHD, FHD)
  const explicitResolutionPatterns = /\b(144p|240p|360p|480p|576p|720p|1080p|1440p|2160p|4k|8k)\b/i;
  const explicitMatch = explicitResolutionPatterns.exec(filename);

  if (explicitMatch) {
    const matched = explicitMatch[0].toLowerCase();
    // Map the matched explicit resolution
    if (matched === '4k') return '2160p';
    if (matched === '8k') return '4320p';
    if (patterns[matched]) return matched;
    // Try to find the pattern that includes this explicit match
    for (const [key, pattern] of Object.entries(patterns)) {
      if (pattern.test(filename)) {
        // Check if this pattern would match our explicit resolution
        if (key === '2160p' && (matched === '4k' || matched === '2160p')) return key;
        if (key === '1080p' && matched === '1080p') return key;
        if (key === '720p' && matched === '720p') return key;
        if (key === '1440p' && matched === '1440p') return key;
        if (key === '480p' && matched === '480p') return key;
        if (key === '576p' && matched === '576p') return key;
        if (key === '360p' && matched === '360p') return key;
        if (key === '240p' && matched === '240p') return key;
        if (key === '144p' && matched === '144p') return key;
      }
    }
  }

  // Fall back to default pattern matching for generic keywords
  return Object.entries(patterns).find(([_, pattern]) =>
    pattern.test(filename)
  )?.[0];
}

function matchMultiplePatterns(
  filename: string,
  patterns: Record<string, RegExp>
): string[] {
  return Object.entries(patterns)
    .filter(([_, pattern]) => pattern.test(filename))
    .map(([tag]) => tag);
}

export function mapLanguageCode(code: string): string {
  switch (code.toLowerCase()) {
    case 'zh-tw':
    case 'zh-hans':
      return 'zh';
    case 'es-419':
      return 'es-MX';
    default:
      return code;
  }
}

export function convertLangCodeToName(code: string): string | undefined {
  const parts = code.split('-');
  const possibleLangs = FULL_LANGUAGE_MAPPING.filter((language) => {
    if (parts.length === 2) {
      return (
        language.iso_639_1?.toLowerCase() === parts[0].toLowerCase() &&
        language.iso_3166_1?.toLowerCase() === parts[1].toLowerCase()
      );
    } else {
      return language.iso_639_1?.toLowerCase() === parts[0].toLowerCase();
    }
  });
  let chosenLang =
    possibleLangs.find((lang) => lang.flag_priority) || possibleLangs[0];
  if (chosenLang) {
    const candidateLang = (
      chosenLang.internal_english_name || chosenLang.english_name
    )
      .split(/;|\(/)[0]
      .trim();
    if (LANGUAGES.includes(candidateLang as any)) {
      return candidateLang;
    } else {
      return undefined;
    }
  }
}

class FileParser {
  private static parser = new Parser().addHandlers(
    handlers.filter((handler) => handler.field !== 'country')
  );

  static parse(filename: string): ParsedFile {
    const parsed = this.parser.parse(filename);
    if (
      ['vinland', 'furiosaamadmax', 'horizonanamerican'].includes(
        (parsed.title || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\p{L}\p{N}+]/gu, '')
          .toLowerCase()
      ) &&
      parsed.complete
    ) {
      parsed.title += ' Saga';
    }
    // prevent the title from being parsed for info
    if (parsed.title && parsed.title.length > 4) {
      filename = filename.replace(parsed.title, '').trim();
      filename = filename.replace(/\s+/g, '.').replace(/^\.+|\.+$/g, '');
    }
    const resolution = matchPattern(filename, PARSE_REGEX.resolutions);
    const quality = matchPattern(filename, PARSE_REGEX.qualities);
    const encode = matchPattern(filename, PARSE_REGEX.encodes);
    const audioChannels = matchMultiplePatterns(
      filename,
      PARSE_REGEX.audioChannels
    );
    const visualTags = matchMultiplePatterns(filename, PARSE_REGEX.visualTags);
    const audioTags = matchMultiplePatterns(filename, PARSE_REGEX.audioTags);
    const mapParsedLanguageToKnown = (lang: string): string | undefined => {
      switch (lang.toLowerCase()) {
        case 'multi audio':
          return 'Multi';
        case 'dual audio':
          return 'Dual Audio';
        case 'multi subs':
          return undefined;
        default:
          return convertLangCodeToName(mapLanguageCode(lang));
      }
    };

    let filenameForLangParsing = filename;
    if (parsed.group?.toLowerCase() === 'ind') {
      filenameForLangParsing = filenameForLangParsing.replace(/ind/i, '');
    }
    const languages = [
      ...new Set([
        ...matchMultiplePatterns(filenameForLangParsing, PARSE_REGEX.languages),
        ...(parsed.languages || [])
          .map(mapParsedLanguageToKnown)
          .filter((lang): lang is string => !!lang),
      ]),
    ];

    const releaseGroup =
      filename.match(PARSE_REGEX.releaseGroup)?.[1] ?? parsed.group;
    const title = parsed.title;
    const year = parsed.year ? parsed.year.toString() : undefined;

    return {
      resolution,
      quality,
      languages,
      encode,
      audioChannels,
      audioTags,
      visualTags,
      releaseGroup,
      title,
      year,
      edition: parsed.edition,
      remastered: parsed.remastered ?? false,
      repack: parsed.repack ?? false,
      uncensored: parsed.uncensored ?? false,
      unrated: parsed.unrated ?? false,
      upscaled: parsed.upscaled ?? false,
      network: parsed.network,
      container: parsed.container,
      extension: parsed.extension,
      seasons: parsed.seasons,
      episodes: parsed.episodes,
      seasonPack: !!(parsed.seasons?.length && !parsed.episodes?.length),
    };
  }
}

export default FileParser;
