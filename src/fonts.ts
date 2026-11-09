import archivo from '@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff?url';
import bungee from '@fontsource/bungee/files/bungee-latin-400-normal.woff?url';
import oswald from '@fontsource/oswald/files/oswald-latin-700-normal.woff?url';
import fredoka from '@fontsource/fredoka/files/fredoka-latin-700-normal.woff?url';
import righteous from '@fontsource/righteous/files/righteous-latin-400-normal.woff?url';
import dancing from '@fontsource/dancing-script/files/dancing-script-latin-700-normal.woff?url';
import pacifico from '@fontsource/pacifico/files/pacifico-latin-400-normal.woff?url';

import archivoExt from '@fontsource/archivo-black/files/archivo-black-latin-ext-400-normal.woff?url';
import bungeeExt from '@fontsource/bungee/files/bungee-latin-ext-400-normal.woff?url';
import oswaldExt from '@fontsource/oswald/files/oswald-latin-ext-700-normal.woff?url';
import fredokaExt from '@fontsource/fredoka/files/fredoka-latin-ext-700-normal.woff?url';
import righteousExt from '@fontsource/righteous/files/righteous-latin-ext-400-normal.woff?url';
import dancingExt from '@fontsource/dancing-script/files/dancing-script-latin-ext-700-normal.woff?url';
import pacificoExt from '@fontsource/pacifico/files/pacifico-latin-ext-400-normal.woff?url';

export interface FontDef {
  key: string;
  label: string;
  css: string;
  url: string;
  /** Extra glyphs (accents such as ğ ş ı ő ł) live in a separate latin-ext file. */
  extUrl?: string;
}

export const FONTS: FontDef[] = [
  { key: 'archivo', label: 'Archivo Black', css: 'Archivo Black', url: archivo, extUrl: archivoExt },
  { key: 'bungee', label: 'Bungee', css: 'Bungee', url: bungee, extUrl: bungeeExt },
  { key: 'oswald', label: 'Oswald Bold', css: 'Oswald', url: oswald, extUrl: oswaldExt },
  { key: 'fredoka', label: 'Fredoka Bold', css: 'Fredoka', url: fredoka, extUrl: fredokaExt },
  { key: 'righteous', label: 'Righteous', css: 'Righteous', url: righteous, extUrl: righteousExt },
  { key: 'pacifico', label: 'Pacifico (script)', css: 'Pacifico', url: pacifico, extUrl: pacificoExt },
  { key: 'dancing', label: 'Dancing Script (script)', css: 'Dancing Script', url: dancing, extUrl: dancingExt },
];
