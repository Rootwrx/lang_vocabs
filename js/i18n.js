/* i18n.js — course languages (the language you learn) and interface texts (English / Français).
 * Add a course language: one entry in LANGS, one dictionary in UI, labels in GROUP_LABELS. */
const LANGS = {
  en: { name: 'English',  short: 'EN', flag: '🇬🇧', tts: 'en-US', yg: 'english' },
  fr: { name: 'Français', short: 'FR', flag: '🇫🇷', tts: 'fr-FR', yg: 'french'  }
};
const GROUP_ICON = { 'Business': '💼', 'By Level': '📶', 'Daily Life': '🏡', 'Health': '🩺', 'IELTS': '🎓', 'TOEFL': '📝', 'Travel': '✈️', 'Other': '📁' };
const GROUP_LABELS = {
  fr: { 'Business': 'Travail', 'By Level': 'Par niveau', 'Daily Life': 'Vie quotidienne', 'Health': 'Santé', 'Travel': 'Voyage', 'Other': 'Autres' },
  en: { 'Other': 'Other' }
};
const UI = {
  en: {
    home: 'Home', lists: 'Your lists', search: 'Search lists and words (English, French or Arabic)…', cont: 'Continue', due: 'due', words: 'words', word: 'word',
    part: 'part', parts: 'parts', topics_started: '{a}/{b} topics started', all_cats: 'All categories', not_started: 'Not started', expected: '~{n} words to add',
    filter_topics: 'Filter topics…', f_all: 'All', f_started: 'Started', f_due: 'Due', no_topics: 'No topics match.', no_lists_lang: 'No lists in this language yet.',
    edit: '✏️ Edit lists', done_edit: '✓ Done editing', upload: '⬆️ Upload lists', add_part: '⬆️ Add part', words_h: 'Words', appears_in: 'appears in',
    not_headword: '“{q}” is not a headword in any list.', watch: 'Watch “{q}” on YouGlish', videos: 'Videos', videos_for: 'Videos for “{w}”',
    learn: 'Learn', learn_d: 'Go through every word with meaning, examples, collocations and the texts it appears in.', start_learning: 'Start learning',
    read: 'Read in context', flash: 'Flashcards', flash_d: 'Type the missing word before you see it. Spaced repetition schedules each word.', review_now: 'Review now',
    started: 'started', reset: 'Reset progress', reset_confirm: 'Reset progress for this list?', other_parts: 'Other parts of this set', prev_part: '← Previous part', next_part: 'Next part →',
    back: '← Back', next: 'Next →', prev: '← Previous', start_flash: 'Start flashcards →', flashcards_arrow: 'Flashcards →', next_text: 'Next text →', text: 'Text',
    examples: 'Examples', collocations: 'Collocations', in_texts: 'In the texts', family: 'Word family', tap_word: 'Tap an underlined word to see it.', toggle_ar: 'Show / hide Arabic',
    fill: 'Fill in the blank', which: 'Which word?', hint_ar: 'Hint: Arabic', type_ph: 'Type the word (leave empty if you don’t know)', check: 'Check', left: 'left',
    correct: '✓ Correct', accents: '✓ Correct — mind the accents: ', answer: '✗ The answer: ', honest: 'Be honest: hesitated or peeked = Hard/Again.',
    again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy', all_done: '🎉 All done', next_due: 'Next card due ', back_list: 'Back to list',
    settings: 'Settings', appearance: '🎨 Appearance', theme: 'Theme', th_auto: 'Match my device', th_light: 'Light', th_dark: 'Dark', arabic: 'Arabic', show_ar: 'Show Arabic', hide_ar: 'Hide Arabic',
    videos_s: 'Videos', show_v: 'Show video buttons', hide_v: 'Hide all videos', language: '🌍 Language', course: 'Course language', iface: 'Interface language', ui_auto: 'Same as course',
    yg_h: '🎬 YouGlish videos', yg_n: 'Videos per word / collocation', yg_acc: 'Accent (English only)', yg_auto: 'Autoplay', off: 'Off', on: 'On', yg_where: 'Show video buttons for',
    w_both: 'Words and collocations', w_words: 'Words only', w_cols: 'Collocations only', yg_note: 'Videos load only when you tap a 🎬 button. Saved automatically on this device.',
    us: 'American', uk: 'British', aus: 'Australian', any: 'Any', data: 'Data', clean: 'Clean up progress of deleted lists',
    unknown_cat: 'Unknown category.', serve_hint: 'If you opened the file directly, serve it over http (e.g. python -m http.server) or via GitHub Pages.',
    none_yet: 'Not started', toggle_theme: 'Theme', no_clips: 'No clips found', loading_v: 'Loading videos…', yg_fail: 'YouGlish could not be loaded.', yg_err: 'Could not load clips',
    open_yg: 'Open “{q}” on YouGlish ↗', topics: 'topics', started_chip: 'started', go_top: 'Top', jump: 'Jump to word', gender: 'Gender & plural', forms: 'Forms', pattern: 'Pattern'
  },
  fr: {
    home: 'Accueil', lists: 'Mes listes', search: 'Rechercher des listes et des mots (anglais, français ou arabe)…', cont: 'Continuer', due: 'à réviser', words: 'mots', word: 'mot',
    part: 'partie', parts: 'parties', topics_started: '{a}/{b} thèmes commencés', all_cats: 'Toutes les catégories', not_started: 'Pas commencé', expected: '~{n} mots à ajouter',
    filter_topics: 'Filtrer les thèmes…', f_all: 'Tous', f_started: 'Commencés', f_due: 'À réviser', no_topics: 'Aucun thème trouvé.', no_lists_lang: 'Pas encore de listes dans cette langue.',
    edit: '✏️ Modifier les listes', done_edit: '✓ Terminé', upload: '⬆️ Importer des listes', add_part: '⬆️ Ajouter une partie', words_h: 'Mots', appears_in: 'présent dans',
    not_headword: '« {q} » n’est l’entrée d’aucune liste.', watch: 'Voir « {q} » sur YouGlish', videos: 'Vidéos', videos_for: 'Vidéos pour « {w} »',
    learn: 'Apprendre', learn_d: 'Parcourez chaque mot avec son sens, des exemples, des collocations et les textes où il apparaît.', start_learning: 'Commencer',
    read: 'Lire en contexte', flash: 'Cartes mémoire', flash_d: 'Tapez le mot manquant avant de le voir. La répétition espacée planifie chaque mot.', review_now: 'Réviser',
    started: 'commencés', reset: 'Réinitialiser la progression', reset_confirm: 'Réinitialiser la progression de cette liste ?', other_parts: 'Autres parties de ce thème', prev_part: '← Partie précédente', next_part: 'Partie suivante →',
    back: '← Retour', next: 'Suivant →', prev: '← Précédent', start_flash: 'Passer aux cartes →', flashcards_arrow: 'Cartes →', next_text: 'Texte suivant →', text: 'Texte',
    examples: 'Exemples', collocations: 'Collocations', in_texts: 'Dans les textes', family: 'Famille de mots', tap_word: 'Touchez un mot souligné pour le voir.', toggle_ar: 'Afficher / masquer l’arabe',
    fill: 'Complétez la phrase', which: 'Quel mot ?', hint_ar: 'Indice : arabe', type_ph: 'Tapez le mot (laissez vide si vous ne savez pas)', check: 'Vérifier', left: 'restantes',
    correct: '✓ Correct', accents: '✓ Correct — attention aux accents : ', answer: '✗ La réponse : ', honest: 'Soyez honnête : hésité ou triché = Difficile/Encore.',
    again: 'Encore', hard: 'Difficile', good: 'Bien', easy: 'Facile', all_done: '🎉 Terminé', next_due: 'Prochaine carte : ', back_list: 'Retour à la liste',
    settings: 'Réglages', appearance: '🎨 Apparence', theme: 'Thème', th_auto: 'Comme mon appareil', th_light: 'Clair', th_dark: 'Sombre', arabic: 'Arabe', show_ar: 'Afficher l’arabe', hide_ar: 'Masquer l’arabe',
    videos_s: 'Vidéos', show_v: 'Afficher les boutons vidéo', hide_v: 'Masquer les vidéos', language: '🌍 Langue', course: 'Langue du cours', iface: 'Langue de l’interface', ui_auto: 'Comme le cours',
    yg_h: '🎬 Vidéos YouGlish', yg_n: 'Vidéos par mot / collocation', yg_acc: 'Accent (anglais uniquement)', yg_auto: 'Lecture auto', off: 'Non', on: 'Oui', yg_where: 'Boutons vidéo pour',
    w_both: 'Mots et collocations', w_words: 'Mots seulement', w_cols: 'Collocations seulement', yg_note: 'Les vidéos ne se chargent que si vous touchez un bouton 🎬. Enregistré automatiquement sur cet appareil.',
    us: 'Américain', uk: 'Britannique', aus: 'Australien', any: 'Tous', data: 'Données', clean: 'Nettoyer la progression des listes supprimées',
    unknown_cat: 'Catégorie inconnue.', serve_hint: 'Si vous avez ouvert le fichier directement, servez-le en http (ex. python -m http.server) ou via GitHub Pages.',
    none_yet: 'Pas commencé', toggle_theme: 'Thème', no_clips: 'Aucun extrait', loading_v: 'Chargement des vidéos…', yg_fail: 'Impossible de charger YouGlish.', yg_err: 'Impossible de charger les extraits',
    open_yg: 'Ouvrir « {q} » sur YouGlish ↗', topics: 'thèmes', started_chip: 'commencé', go_top: 'Haut', jump: 'Aller au mot', gender: 'Genre et pluriel', forms: 'Formes', pattern: 'Construction'
  }
};
/* t('key', {n: 3}) — interface text in the chosen interface language (settings), default: the course language */
const uiLang = () => (typeof G !== 'undefined' && G.ui && G.ui !== 'auto' ? G.ui : (typeof G !== 'undefined' && G.course) || 'en');
const t = (k, v) => { let s = (UI[uiLang()] || UI.en)[k] ?? UI.en[k] ?? k; if (v) for (const x in v) s = s.split('{' + x + '}').join(v[x]); return s; };
const groupLabel = g => (GROUP_LABELS[uiLang()] || {})[g || 'Other'] || g || 'Other';
const groupIcon = g => GROUP_ICON[g || 'Other'] || '📂';
