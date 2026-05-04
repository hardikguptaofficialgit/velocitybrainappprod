const DICEBEAR_BASE_URL = 'https://api.dicebear.com/9.x';

const avatarDefinitions = [
  { id: 'studio-spark', label: 'Studio Spark', style: 'bottts-neutral', seed: 'Studio Spark', background: 'f59e0b' },
  { id: 'orbit-signal', label: 'Orbit Signal', style: 'shapes', seed: 'Orbit Signal', background: 'fb7185' },
  { id: 'pixel-drift', label: 'Pixel Drift', style: 'identicon', seed: 'Pixel Drift', background: '38bdf8' },
  { id: 'cinder-loop', label: 'Cinder Loop', style: 'rings', seed: 'Cinder Loop', background: 'a78bfa' },
  { id: 'nova-echo', label: 'Nova Echo', style: 'thumbs', seed: 'Nova Echo', background: '34d399' },
  { id: 'glow-circuit', label: 'Glow Circuit', style: 'bottts-neutral', seed: 'Glow Circuit', background: 'f97316' },
  { id: 'mosaic-wave', label: 'Mosaic Wave', style: 'shapes', seed: 'Mosaic Wave', background: '22c55e' },
  { id: 'quiet-comet', label: 'Quiet Comet', style: 'identicon', seed: 'Quiet Comet', background: 'e879f9' }
];

export const buildDicebearAvatarUrl = ({ style, seed, background }) => (
  `${DICEBEAR_BASE_URL}/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${encodeURIComponent(background)}`
);

export const curatedAvatarOptions = avatarDefinitions.map((avatar) => ({
  ...avatar,
  url: buildDicebearAvatarUrl(avatar)
}));

export const defaultCuratedAvatar = curatedAvatarOptions[0].url;
export const curatedAvatarUrlSet = new Set(curatedAvatarOptions.map((avatar) => avatar.url));

export const isCuratedAvatarUrl = (value) => curatedAvatarUrlSet.has(value);
