"use client";

import { useEffect, useState, useMemo } from 'react';

// Define types based on our JSON structure
interface Journal {
  title: string;
  issn: string;
  field: string;
  abs_rank: string | null;
  fms_rank: string | null;
  is_ft50: boolean;
  is_utd24: boolean;
}

export default function JournalFilter() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [selectedAbsRanks, setSelectedAbsRanks] = useState<string[]>([]);
  const [selectedFmsRanks, setSelectedFmsRanks] = useState<string[]>([]);
  const [isFt50, setIsFt50] = useState(false);
  const [isUtd24, setIsUtd24] = useState(false);
  
  // Keyword Input
  const [keywords, setKeywords] = useState("");

  // UI States
  const [generatedQuery, setGeneratedQuery] = useState("");

  // Load Data
  useEffect(() => {
    fetch('/journals.json')
      .then(res => res.json())
      .then(data => {
        setJournals(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load journals", err);
        setLoading(false);
      });
  }, []);

  // Extract Unique Options
  const uniqueFields = useMemo(() => {
    const fields = new Set(journals.map(j => j.field).filter(Boolean));
    return Array.from(fields).sort();
  }, [journals]);

  const uniqueAbsRanks = useMemo(() => {
    return ["4*", "4", "3", "2", "1"];
  }, []);

  const uniqueFmsRanks = useMemo(() => {
    // FMS ranks are typically A, B, C, D in the file based on the python script check
    // user mentioned "fms等级", commonly A, B, C, D
    // I'll grab them dynamically to be safe, but sort them specifically
    const ranks = new Set(journals.map(j => j.fms_rank).filter(Boolean) as string[]);
    // Custom sort order
    const order = ['A', 'B', 'C', 'D']; 
    return Array.from(ranks).sort((a, b) => {
      const idxA = order.indexOf(a);
      const idxB = order.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [journals]);

  // Filtering Logic
  const filteredJournals = useMemo(() => {
    return journals.filter(journal => {
      // 1. FT50 / UTD24 (OR logic if both selected? or AND? User logic in python script was OR for "both")
      // "both: FT50 OR UTD24 (union)" in python script.
      // But here we have checkboxes. If I select FT50, I want FT50. If I select UTD24, I want UTD24.
      // If I select BOTH, do I want intersection or union? Python script said "union".
      // Let's implement Union for Special Lists if any are selected.
      // BUT, checking the fields/ranks is usually an intersection with the special lists.
      // Examples: "FT50 journals in Finance".
      
      // Filter by Special Lists
      let matchesSpecial = true;
      if (isFt50 || isUtd24) {
        matchesSpecial = (isFt50 && journal.is_ft50) || (isUtd24 && journal.is_utd24);
      }
      if (!matchesSpecial) return false;

      // Filter by Field
      if (selectedFields.length > 0) {
        if (!selectedFields.includes(journal.field)) return false;
      }

      // Filter by Rank
      // Logic: (Match ABS OR Match FMS)? Or (Match ABS AND Match FMS)?
      // Usually users want "ABS 3 OR FMS B".
      // Let's assume Union of Rank criteria if multiple categories are used?
      // Or maybe Intersection between categories (ABS vs FMS) but Union within category?
      // "4* or 4" is Union.
      // "ABS 3" AND "FMS A" is rarely useful (too restrictive). usually "ABS 3 or higher OR FMS B or higher".
      // Let's treat distinct rank systems as additive (OR). 
      // If user selects ABS 4 and FMS A, do they want journals that are BOTH?
      // Given the user said "manually select... logic similar to before", 
      // The old script `generate_wos_query` had: `star_levels` (ABS). It didn't have FMS.
      // If I add FMS, logical behavior usually implies "Show me journals that meet ANY of my quality criteria".
      // So: (ABS in selected_abs) OR (FMS in selected_fms).
      // BUT if NO abs selected and ONLY fms selected, then just FMS.
      // If BOTH selected, then UNION.
      // If NEITHER selected, then IGNORE rank filter (unless filtered by something else like FT50)?
      
      let matchesAbs = true;
      let matchesFms = true;
      const hasAbsSelection = selectedAbsRanks.length > 0;
      const hasFmsSelection = selectedFmsRanks.length > 0;

      if (hasAbsSelection) {
        matchesAbs = journal.abs_rank !== null && selectedAbsRanks.includes(journal.abs_rank);
      }
      
      if (hasFmsSelection) {
        matchesFms = journal.fms_rank !== null && selectedFmsRanks.includes(journal.fms_rank);
      }

      // If both filters are active, we construct Union: (MatchesABS OR MatchesFMS)
      // If only one is active, we check that one.
      // If neither, we pass.
      if (hasAbsSelection && hasFmsSelection) {
        if (!(matchesAbs || matchesFms)) return false;
      } else if (hasAbsSelection) {
        if (!matchesAbs) return false;
      } else if (hasFmsSelection) {
        if (!matchesFms) return false;
      }

      return true;
    });
  }, [journals, selectedFields, selectedAbsRanks, selectedFmsRanks, isFt50, isUtd24]);

  // Generate Query
  useEffect(() => {
    if (filteredJournals.length === 0) {
      setGeneratedQuery("");
      return;
    }

    const issns = filteredJournals
        .map(j => j.issn)
        .filter(issn => issn && issn.length > 4 && issn !== 'nan') 
        // Simple validation, python script checked for 'nan'.
        // My python script outputted 'nan' as string? No, I handled it.
        .map(issn => issn.trim());
    
    // De-duplicate
    const uniqueIssns = Array.from(new Set(issns));
    
    if (uniqueIssns.length === 0) {
      setGeneratedQuery("");
      return;
    }
    
    const issnQuery = `IS=(${uniqueIssns.join(' OR ')})`;
    
    let finalQuery = issnQuery;
    if (keywords.trim()) {
       // Combine with keywords
       // User input: "supply chain"
       // Output: IS=(...) AND TS=("supply chain") 
       // We'll wrap keywords in parentheses if not already
       let kw = keywords.trim();
       // intelligent wrapping?
       // If user typed `("A" OR "B")`, we use it. 
       // If user typed `supply chain`, we use `TS=(supply chain)`.
       // Let's assume user provides the TS content or full TS expression?
       // User said: "User inputs keywords... output a complete search query"
       // "can be used to directly copy paste to wos"
       // Usually `TS=(...)`.
       // I'll wrap it in `TS=(...)`
       finalQuery = `(${issnQuery}) AND TS=(${kw})`;
    }

    setGeneratedQuery(finalQuery);
  }, [filteredJournals, keywords]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedQuery);
    alert("Copied to clipboard!");
  };

  const toggleSelection = (list: string[], item: string, setter: (val: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter(i => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden">
        {/* Header */}
        <header className="bg-gradient-to-r from-blue-700 to-indigo-800 p-8 text-white">
          <h1 className="text-3xl font-bold">WoS Search Generator</h1>
          <p className="opacity-80 mt-2">Generate advanced search queries for Web of Science based on journal rankings and fields.</p>
        </header>

        <main className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Filters */}
          <div className="lg:col-span-4 space-y-8 border-r border-gray-100 pr-4">
            
            {/* Special Collections */}
            <section>
              <h3 className="font-semibold text-gray-700 mb-3 uppercase tracking-wider text-sm">Special Collections</h3>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center space-x-2 cursor-pointer select-none border px-3 py-2 rounded-lg hover:bg-gray-50 transition">
                  <input 
                    type="checkbox" 
                    checked={isFt50} 
                    onChange={e => setIsFt50(e.target.checked)} 
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="font-medium">FT50</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer select-none border px-3 py-2 rounded-lg hover:bg-gray-50 transition">
                  <input 
                    type="checkbox" 
                    checked={isUtd24} 
                    onChange={e => setIsUtd24(e.target.checked)} 
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="font-medium">UTD24</span>
                </label>
              </div>
            </section>

            {/* ABS Rankings */}
            <section>
              <h3 className="font-semibold text-gray-700 mb-3 uppercase tracking-wider text-sm">ABS Ranking (2024)</h3>
              <div className="flex flex-wrap gap-2">
                {uniqueAbsRanks.map(rank => (
                  <button
                    key={rank}
                    onClick={() => toggleSelection(selectedAbsRanks, rank, setSelectedAbsRanks)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                      selectedAbsRanks.includes(rank)
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {rank}
                  </button>
                ))}
              </div>
            </section>

            {/* FMS Rankings */}
            <section>
              <h3 className="font-semibold text-gray-700 mb-3 uppercase tracking-wider text-sm">FMS Ranking (2025)</h3>
              <div className="flex flex-wrap gap-2">
                {uniqueFmsRanks.map(rank => (
                  <button
                    key={rank}
                    onClick={() => toggleSelection(selectedFmsRanks, rank, setSelectedFmsRanks)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                      selectedFmsRanks.includes(rank)
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                   Level {rank}
                  </button>
                ))}
              </div>
            </section>

            {/* Fields */}
            <section>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-700 uppercase tracking-wider text-sm">Research Fields</h3>
                <button 
                  onClick={() => setSelectedFields(selectedFields.length === uniqueFields.length ? [] : [...uniqueFields])}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {selectedFields.length === uniqueFields.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1 p-2 border rounded-lg bg-gray-50 text-sm scrollbar-thin scrollbar-thumb-gray-300">
                {uniqueFields.map(field => (
                  <label key={field} className="flex items-center space-x-2 p-1.5 hover:bg-white rounded cursor-pointer transition">
                    <input 
                      type="checkbox" 
                      checked={selectedFields.includes(field)}
                      onChange={() => toggleSelection(selectedFields, field, setSelectedFields)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="truncate" title={field}>{field}</span>
                  </label>
                ))}
              </div>
            </section>

          </div>

          {/* Right Panel: Output & Preview */}
          <div className="lg:col-span-8 flex flex-col h-full">
            
            {/* Query Section */}
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Query Builder</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Keywords (Optional)</label>
                <textarea
                  className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder='e.g. "artificial intelligence" OR "machine learning"'
                  rows={2}
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Keywords will be wrapped in TS=(...).</p>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">Generated WoS Query</label>
                <div className="w-full p-4 bg-white border border-gray-300 rounded-lg font-mono text-sm text-gray-600 break-all h-32 overflow-y-auto">
                   {generatedQuery || <span className="text-gray-400 italic">Select filters to generate query...</span>}
                </div>
                {generatedQuery && (
                  <button
                    onClick={copyToClipboard}
                    className="absolute top-9 right-4 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 shadow-md transition"
                  >
                    Copy Query
                  </button>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <span>Matched Journals: <strong className="text-gray-900">{filteredJournals.length}</strong></span>
              </div>
            </div>

            {/* Journal List Preview */}
            <div className="flex-1 flex flex-col min-h-0">
              <h3 className="font-semibold text-gray-700 mb-3">Matched Journals Preview</h3>
              <div className="flex-1 overflow-auto border border-gray-200 rounded-lg shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 text-gray-600 font-medium sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Journal Name</th>
                      <th className="px-4 py-3 w-32">Rankings</th>
                      <th className="px-4 py-3 w-48">Field</th>
                      <th className="px-4 py-3 w-32">ISSN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredJournals.length > 0 ? (
                      filteredJournals.map((journal, idx) => (
                        <tr key={idx} className="hover:bg-blue-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{journal.title}</td>
                          <td className="px-4 py-3">
                             <div className="flex gap-1 flex-wrap">
                                {journal.abs_rank && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">ABS {journal.abs_rank}</span>}
                                {journal.fms_rank && <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded">FMS {journal.fms_rank}</span>}
                                {journal.is_ft50 && <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded">FT50</span>}
                                {journal.is_utd24 && <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded">UTD24</span>}
                             </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{journal.field}</td>
                          <td className="px-4 py-3 font-mono text-gray-500 text-xs">{journal.issn}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500">
                          No journals found. Adjust your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
