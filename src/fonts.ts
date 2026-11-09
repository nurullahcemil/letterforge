import archivo from '@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff?url';
import bungee from '@fontsource/bungee/files/bungee-latin-400-normal.woff?url';
import oswald from '@fontsource/oswald/files/oswald-latin-700-normal.woff?url';
import fredoka from '@fontsource/fredoka/files/fredoka-latin-700-normal.woff?url';
import righteous from '@fontsource/righteous/files/righteous-latin-400-normal.woff?url';
import dancing from '@fontsource/dancing-script/files/dancing-script-latin-700-normal.woff?url';
import pacifico from '@fontsource/pacifico/files/pacifico-latin-400-normal.woff?url';

export interface FontDef {
  key: string;
  label: string;
  css: string;
  url: string;
}

export const FONTS: FontDef[] = [
  { key: 'archivo', label: 'Archivo Black', css: 'Archivo Black', url: archivo },
  { key: 'bungee', label: 'Bungee', css: 'Bungee', url: bungee },
  { key: 'oswald', label: 'Oswald Bold', css: 'Oswald', url: oswald },
  { key: 'fredoka', label: 'Fredoka Bold', css: 'Fredoka', url: fredoka },
  { key: 'righteous', label: 'Righteous', css: 'Righteous', url: righteous },
  { key: 'pacifico', label: 'Pacifico (script)', css: 'Pacifico', url: pacifico },
  { key: 'dancing', label: 'Dancing Script (script)', css: 'Dancing Script', url: dancing },
];
