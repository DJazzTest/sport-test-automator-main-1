export type FailureItem = {
    type: 'link' | 'image' | 'test';
    url: string;
    reason: string;
  };
  
  export const failures: FailureItem[] = [];
  
  export function recordFailure(type: FailureItem['type'], url: string, reason: string) {
    failures.push({ type, url, reason });
  }
  
  export function printSummary(siteName: string) {
    if (failures.length === 0) {
      console.log(`\n✅ ${siteName} tested — no defects identified ✅ Passed ✅\n`);
      return;
    }
  
    console.log(`\n❌ ${siteName} defects detected:\n`);
  
    failures.forEach((f, i) => {
      console.log(`${i + 1}. [${f.type.toUpperCase()}] ${f.url}`);
      console.log(`   Reason: ${f.reason}\n`);
    });
  }
  