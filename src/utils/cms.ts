
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface Project {
  title: string;
  description: string;
  logo: string;
  bgGradient: string;
  buttonColor: string;
  buttonHoverColor: string;
  url: string;
  features: Array<{
    icon: string;
    text: string;
  }>;
}

// Palette de couleurs prédéfinies
const COLOR_PALETTE = [
  {
    bgGradient: 'bg-gradient-to-br from-green-600 to-green-800',
    buttonColor: 'bg-green-600',
    buttonHoverColor: 'hover:bg-green-700',
  },
  {
    bgGradient: 'bg-gradient-to-br from-gray-900 to-black',
    buttonColor: 'bg-black',
    buttonHoverColor: 'hover:bg-gray-800',
  },
  {
    bgGradient: 'bg-gradient-to-br from-gray-700 to-gray-900',
    buttonColor: 'bg-gray-800',
    buttonHoverColor: 'hover:bg-gray-700',
  },
  {
    bgGradient: 'bg-gradient-to-br from-karibu-green to-green-700',
    buttonColor: 'bg-karibu-green',
    buttonHoverColor: 'hover:bg-green-700',
  },
  {
    bgGradient: 'bg-gradient-to-br from-yam-red to-red-700',
    buttonColor: 'bg-yam-red',
    buttonHoverColor: 'hover:bg-red-700',
  },
  {
    bgGradient: 'bg-gradient-to-br from-blue-600 to-blue-800',
    buttonColor: 'bg-blue-600',
    buttonHoverColor: 'hover:bg-blue-700',
  },
  {
    bgGradient: 'bg-gradient-to-br from-purple-600 to-purple-800',
    buttonColor: 'bg-purple-600',
    buttonHoverColor: 'hover:bg-purple-700',
  },
  {
    bgGradient: 'bg-gradient-to-br from-orange-600 to-orange-800',
    buttonColor: 'bg-orange-600',
    buttonHoverColor: 'hover:bg-orange-700',
  },
];

export interface Hero {
  active: boolean;
  page: string;
  title: string;
  highlightedText: string;
  description: string;
  backgroundImage: string;
  ctaText?: string;
  ctaUrl?: string;
  showWaveDivider: boolean;
}

export function getProjects(): Project[] {
  const projectsDir = path.join(process.cwd(), 'src/content/projects');
  
  if (!fs.existsSync(projectsDir)) {
    return [];
  }

  const files = fs.readdirSync(projectsDir).filter(file => file.endsWith('.md') && !file.startsWith('.'));
  
  return files.map((file, index) => {
    const filePath = path.join(projectsDir, file);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    // Parse the frontmatter with gray-matter
    const parsed = matter(fileContent);
    const data = parsed.data;
    
    // Assigner une couleur de la palette (rotation circulaire)
    const colors = COLOR_PALETTE[index % COLOR_PALETTE.length];
    
    return {
      title: data.title || file.replace('.md', '').replace(/-/g, ' '),
      description: data.description || '',
      logo: data.logo || '/images/yem.webp',
      url: data.url || '#',
      features: Array.isArray(data.features) ? data.features : [],
      bgGradient: colors.bgGradient,
      buttonColor: colors.buttonColor,
      buttonHoverColor: colors.buttonHoverColor,
    } as Project;
  });
}

export function getActiveHero(page: string): Hero | null {
  const heroesDir = path.join(process.cwd(), 'src/content/heroes');
  
  if (!fs.existsSync(heroesDir)) {
    return null;
  }

  const files = fs.readdirSync(heroesDir).filter(file => file.endsWith('.md'));
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(heroesDir, file), 'utf-8');
    const { data } = matter(content);
    
    if (data.active && data.page === page) {
      return data as Hero;
    }
  }
  
  return null;
}
