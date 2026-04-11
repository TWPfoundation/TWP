import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Repo-Audit: Truth-Claims Alignment', () => {
  const rootDir = path.resolve(__dirname, '../../');
  
  it('should align package.json version with CHANGELOG.md claims', () => {
    const packageJsonPath = path.join(rootDir, 'package.json');
    const changelogPath = path.join(rootDir, 'docs', 'CHANGELOG.md');
    
    expect(fs.existsSync(packageJsonPath)).toBe(true);
    expect(fs.existsSync(changelogPath)).toBe(true);
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const changelog = fs.readFileSync(changelogPath, 'utf8');
    
    // CHANGELOG should boast the version claimed in package.json
    expect(packageJson.version).toBe('0.5.0');
    expect(changelog).toContain(`## [${packageJson.version}]`);
  });

  it('should have a working test script and vitest dependency', () => {
    const packageJsonPath = path.join(rootDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    expect(packageJson.scripts?.test).toBeDefined();
    expect(packageJson.scripts.test).toContain('vitest');
    expect(packageJson.devDependencies?.vitest).toBeDefined();
  });

  it('should not contain deprecated "pre-alpha" terminology in public docs', () => {
    const agentsPath = path.join(rootDir, 'AGENTS.md');
    const readmePath = path.join(rootDir, 'README.md');
    
    const agentsContent = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, 'utf8') : '';
    const readmeContent = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : '';
    
    expect(agentsContent.toLowerCase()).not.toContain('pre-alpha');
    expect(readmeContent.toLowerCase()).not.toContain('pre-alpha');
  });

  it('should have schema.ts asserting admin_roles and consent_records exist', () => {
    const schemaPath = path.join(rootDir, 'src', 'lib', 'db', 'schema.ts');
    expect(fs.existsSync(schemaPath)).toBe(true);
    
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    expect(schemaContent).toContain('export const adminRoles');
    expect(schemaContent).toContain('export const consentRecords');
  });

  it('should have supabase_schema.sql reflecting all required tables', () => {
    const sqlPath = path.join(rootDir, 'supabase_schema.sql');
    expect(fs.existsSync(sqlPath)).toBe(true);
    
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    // Ensure the baseline tables added in recent migrations are present
    expect(sqlContent).toContain('CREATE TABLE public.admin_roles');
    expect(sqlContent).toContain('CREATE TABLE public.consent_records');
    expect(sqlContent).toContain('CREATE TABLE public.testimony_records');
    expect(sqlContent).toContain('CREATE TABLE public.inquisitor_sessions');
  });

  it('should NOT claim dual-rater governance when operating in single-reviewer alpha', () => {
    const govPagePath = path.join(rootDir, 'src', 'app', 'governance', 'page.tsx');
    expect(fs.existsSync(govPagePath)).toBe(true);
    
    const govContent = fs.readFileSync(govPagePath, 'utf8');
    expect(govContent).toContain('Conduct Gate Tier 3 alpha reviews (single reviewer)');
    expect(govContent).not.toContain('blind dual-rater');
  });
});
