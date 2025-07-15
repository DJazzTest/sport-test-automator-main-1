import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [url, setUrl] = useState('');
  const [gherkin, setGherkin] = useState('');
  const [code, setCode] = useState('');
  const [log, setLog] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [testName, setTestName] = useState('');
  const [savedTests, setSavedTests] = useState([]);
  const [running, setRunning] = useState(false);

  const runTest = async () => {
    setRunning(true);
    setLog('Running test...');
    setSuggestions([]);
    try {
      const res = await fetch('http://localhost:5174/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, url })
      });
      const data = await res.json();
      setLog(data.output);
      setSuggestions(data.suggestions || []);
    } catch (e) {
      setLog('Error: ' + e.message);
    }
    setRunning(false);
  };

  const saveTest = async () => {
    if (!testName) {
      alert('Please enter a name for your test');
      return;
    }
    await fetch('http://localhost:5174/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testName, code, url, gherkin })
    });
    alert('Test saved!');
    loadTests();
  };

  const loadTests = async () => {
    const res = await fetch('http://localhost:5174/api/tests');
    const data = await res.json();
    setSavedTests(data.tests || []);
  };

  React.useEffect(() => {
    loadTests();
  }, []);

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h2>Playwright Simple Automation</h2>
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Test Name"
          value={testName}
          onChange={e => setTestName(e.target.value)}
          style={{ width: '100%', marginBottom: 8 }}
        />
        <input
          type="text"
          placeholder="URL to test"
          value={url}
          onChange={e => setUrl(e.target.value)}
          style={{ width: '100%', marginBottom: 8 }}
        />
        <textarea
          placeholder="Gherkin scenario (optional)"
          value={gherkin}
          onChange={e => setGherkin(e.target.value)}
          style={{ width: '100%', minHeight: 60, marginBottom: 8 }}
        />
        <textarea
          placeholder="Playwright automation code (e.g., await page.click('...'))"
          value={code}
          onChange={e => setCode(e.target.value)}
          style={{ width: '100%', minHeight: 120, marginBottom: 8, fontFamily: 'monospace' }}
        />
        <button onClick={runTest} disabled={running} style={{ marginRight: 8 }}>
          {running ? 'Running...' : 'Run Test'}
        </button>
        <button onClick={saveTest} disabled={running || !testName}>
          Save Test
        </button>
      </div>
      <div style={{ marginBottom: 24 }}>
        <h4>Execution Log</h4>
        <pre style={{ background: '#eee', padding: 12, minHeight: 60 }}>{log}</pre>
        {suggestions.length > 0 && (
          <div style={{ background: '#fffbe6', padding: 12, marginTop: 8, border: '1px solid #ffe58f' }}>
            <b>Suggestions:</b>
            <ul>
              {suggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}
      </div>
      <div>
        <h4>Saved Tests</h4>
        <ul>
          {savedTests.map((t, i) => (
            <li key={i}>
              <b>{t.name}</b> - <span>{t.url}</span>
              <button style={{ marginLeft: 8 }} onClick={() => {
                setTestName(t.name); setUrl(t.url); setGherkin(t.gherkin); setCode(t.code);
              }}>Load</button>
            </li>
          ))}
        </ul>
      </div>
      <div style={{marginTop:32, color:'#888', fontSize:13}}>
        <b>Tip:</b> When you run a test, a real Chrome browser window will open. You can watch the automation in real time!
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
