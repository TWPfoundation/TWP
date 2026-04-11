import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TWP_TRUTH } from '../lib/truth';

describe('Repo-Audit: Relational Truth-Claims Alignment', () => {
  const rootDir = path.resolve(__dirname, '../../');
  
  it('should align package.json version with the truth manifest and CHANGELOG.md', () => {
    const packageJsonPath = path.join(rootDir, 'package.json');
    const changelogPath = path.join(rootDir, 'docs', 'CHANGELOG.md');
    
    expect(fs.existsSync(changelogPath)).toBe(true, 'CHANGELOG.md must exist');
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const changelog = fs.readFileSync(changelogPath, 'utf8');
    
    expect(packageJson.version).toBe(TWP_TRUTH.currentVersion);
    expect(changelog).toContain(`## [${TWP_TRUTH.currentVersion}]`);
  });

  it('should verify schema table usage across the application (No Drift)', () => {
    const srcDir = path.join(rootDir, 'src');
    const schemaPath = path.join(rootDir, 'src', 'lib', 'db', 'schema.ts');
    const sqlSchemaPath = path.join(rootDir, 'supabase_schema.sql');
    
    expect(fs.existsSync(schemaPath)).toBe(true, "schema.ts must exist");
    expect(fs.existsSync(sqlSchemaPath)).toBe(true, "supabase_schema.sql must exist");

    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    const sqlSchemaContent = fs.readFileSync(sqlSchemaPath, 'utf8');

    function getAllTsFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
      const files = fs.readdirSync(dirPath);
      files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
          arrayOfFiles = getAllTsFiles(fullPath, arrayOfFiles);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
          arrayOfFiles.push(fullPath);
        }
      });
      return arrayOfFiles;
    }

    const tsFiles = getAllTsFiles(srcDir);
    const discoveredTables = new Set<string>();
    const fromRegex = /\.from\(['"]([a-z_]+)['"]\)/g;

    tsFiles.forEach(file => {
      if (file.includes('schema.ts') || file.includes('truth.test.ts')) return;
      
      const content = fs.readFileSync(file, 'utf8');
      let match;
      while ((match = fromRegex.exec(content)) !== null) {
        discoveredTables.add(match[1]);
      }
    });

    discoveredTables.forEach(table => {
      const hasTableSql = sqlSchemaContent.includes(`CREATE TABLE public.${table}`) || sqlSchemaContent.includes(`CREATE TABLE IF NOT EXISTS public.${table}`);
      if (!hasTableSql) {
        console.error(`MISSING IN SQL DUMP: ${table}`);
      }
      
      expect(hasTableSql).toBe(true, `Discovered table '${table}' in codebase but it is missing from supabase_schema.sql!`);
      
      const drizzleTablePattern = new RegExp(`pgTable\\(['"]${table}['"]`);
      expect(drizzleTablePattern.test(schemaContent))
        .toBe(true, `Discovered table '${table}' in codebase but it is missing from Drizzle schema.ts!`);
    });
  });

  it('should not contain public narrative contradictions (Stale Phrase Scan)', () => {
    const publicPaths = [
      'src/app/page.tsx',
      'src/app/packet/page.tsx',
      'src/app/privacy/page.tsx',
      'src/app/governance/page.tsx',
      'src/app/status/page.tsx',
      'src/app/api/intake/route.ts',
      'AGENTS.md',
      'README.md'
    ].map(p => path.join(rootDir, p));

    publicPaths.forEach(pagePath => {
      if (!fs.existsSync(pagePath)) return;
      const content = fs.readFileSync(pagePath, 'utf8').toLowerCase();
      
      TWP_TRUTH.forbiddenPhrases.forEach(forbidden => {
        expect(content).not.toContain(
          forbidden.toLowerCase(), 
          `Forbidden stale phrase found in ${path.basename(pagePath)}: "${forbidden}"`
        );
      });
    });
  });

  it('should maintain operational mode consistency', () => {
    if (TWP_TRUTH.reviewMode === "single_reviewer_alpha") {
      const reviewRoutePath = path.join(rootDir, 'src', 'app', 'api', 'admin', 'gate', 'review', 'route.ts');
      
      if (fs.existsSync(reviewRoutePath)) {
        const routeContent = fs.readFileSync(reviewRoutePath, 'utf8');
        expect(routeContent).toContain('tier3_reviewer_a:');
        expect(routeContent).not.toContain('tier3_reviewer_b:');
      }

      const govPagePath = path.join(rootDir, 'src', 'app', 'governance', 'page.tsx');
      if (fs.existsSync(govPagePath)) {
        const govContent = fs.readFileSync(govPagePath, 'utf8').toLowerCase();
        
        const hasSemanticMarker = TWP_TRUTH.semanticMarkers.governanceAlpha.some(marker => 
          govContent.includes(marker.toLowerCase())
        );
        
        expect(hasSemanticMarker).toBe(true, "Governance page fails to semantically declare single-reviewer alpha status.");
      }
    }
  });
});
