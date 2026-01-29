"use client";

import { useEffect, useState, useMemo } from "react";

interface Journal {
  title: string;
  issn: string;
  field_en: string;
  abs_rank: string | null;
  is_ft50: boolean;
  is_utd24: boolean;
}

export default function JournalFilter() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);

  // Language
  const [language, setLanguage] = useState<"en" | "zh">("en");

  // Filters
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [selectedAbsRanks, setSelectedAbsRanks] = useState<string[]>([]);
  const [isFt50, setIsFt50] = useState(false);
  const [isUtd24, setIsUtd24] = useState(false);

  // Keyword Input
  const [keywords, setKeywords] = useState("");

  // UI States
  const [generatedQuery, setGeneratedQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const translations = {
    en: {
      appTitle: "WoS Search Generator",
      appSubtitle:
        "Generate advanced search queries for Web of Science based on journal rankings and fields.",
      languageLabel: "Language",
      specialCollections: "Special Collections",
      absRanking: "ABS Ranking (2024)",
      researchFields: "Research Fields",
      selectAll: "Select All",
      deselectAll: "Deselect All",
      queryBuilder: "Query Builder",
      keywordsLabel: "Additional Keywords (Optional)",
      keywordsExampleLabel: "Example:",
      keywordsExample: "\"artificial intelligence\" OR \"machine learning\"",
      keywordsHelper: "Keywords will be wrapped in TS=(...).",
      keywordsWarning:
        "Keyword format looks invalid. Use quoted phrases and AND/OR operators.",
      keywordsWarningWithTs:
        "Do not include TS=; it will be added automatically.",
      generatedQuery: "Generated WoS Query",
      selectFiltersHint: "Select filters to generate query...",
      copyQuery: "Copy Query",
      matchedJournals: "Matched Journals",
      previewTitle: "Matched Journals Preview",
      columnJournal: "Journal Name",
      columnRank: "Rankings",
      columnField: "Field",
      columnIssn: "ISSN",
      noJournals: "No journals found. Adjust your filters.",
      rowsPerPage: "Rows per page",
      page: "Page",
      of: "of",
      previous: "Previous",
      next: "Next",
      unknownField: "Unknown",
      copied: "Copied to clipboard!",
    },
    zh: {
      appTitle: "WoS 检索式生成器",
      appSubtitle: "基于期刊分级与学科方向生成 Web of Science 高级检索式。",
      languageLabel: "语言",
      specialCollections: "特殊列表",
      absRanking: "ABS 分级 (2024)",
      researchFields: "研究领域",
      selectAll: "全选",
      deselectAll: "取消全选",
      queryBuilder: "检索式构建",
      keywordsLabel: "关键词补充（可选）",
      keywordsExampleLabel: "示例：",
      keywordsExample: "\"artificial intelligence\" OR \"machine learning\"",
      keywordsHelper: "关键词会被自动包装进 TS=(...).",
      keywordsWarning: "关键词格式可能不正确，请使用引号并用 AND/OR 连接。",
      keywordsWarningWithTs: "请不要输入 TS=，系统会自动添加。",
      generatedQuery: "生成的 WoS 检索式",
      selectFiltersHint: "请选择筛选条件以生成检索式…",
      copyQuery: "复制检索式",
      matchedJournals: "匹配期刊数",
      previewTitle: "匹配期刊预览",
      columnJournal: "期刊名称",
      columnRank: "分级",
      columnField: "领域",
      columnIssn: "ISSN",
      noJournals: "未找到期刊，请调整筛选条件。",
      rowsPerPage: "每页显示",
      page: "第",
      of: "页 / 共",
      previous: "上一页",
      next: "下一页",
      unknownField: "未知",
      copied: "已复制到剪贴板！",
    },
  } as const;

  const t = translations[language];

  const getFieldLabel = (journal: Journal) => {
    const field = journal.field_en?.trim();
    if (!field) return t.unknownField;
    return field;
  };

  const validateKeywords = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return { isValid: true, warning: "" };
    if (/TS\s*=/i.test(trimmed)) {
      return { isValid: false, warning: t.keywordsWarningWithTs };
    }
    const quoteCount = (trimmed.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      return { isValid: false, warning: t.keywordsWarning };
    }

    const parts = trimmed.split(/\s+(AND|OR|NOT)\s+/i);
    const terms = parts.filter((_, idx) => idx % 2 === 0);
    const hasInvalidTerm = terms.some((term) => {
      const cleaned = term.replace(/^\(+|\)+$/g, "").trim();
      if (!cleaned) return false;
      const hasSpaces = /\s/.test(cleaned);
      const isQuoted = cleaned.startsWith("\"") && cleaned.endsWith("\"");
      return hasSpaces && !isQuoted;
    });

    if (hasInvalidTerm) return { isValid: false, warning: t.keywordsWarning };
    return { isValid: true, warning: "" };
  };

  // Load Data
  useEffect(() => {
    fetch("/journals.json")
      .then((res) => res.json())
      .then((data) => {
        setJournals(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load journals", err);
        setLoading(false);
      });
  }, []);

  // Extract Unique Options
  const uniqueFields = useMemo(() => {
    const fields = new Set(
      journals.map((j) => getFieldLabel(j)).filter((f) => f && f !== t.unknownField)
    );
    return Array.from(fields).sort();
  }, [journals, language]);

  const uniqueAbsRanks = useMemo(() => {
    return ["4*", "4", "3", "2", "1"];
  }, []);

  // Filtering Logic
  const filteredJournals = useMemo(() => {
    return journals.filter((journal) => {
      // Filter by Special Lists
      let matchesSpecial = true;
      if (isFt50 || isUtd24) {
        matchesSpecial =
          (isFt50 && journal.is_ft50) || (isUtd24 && journal.is_utd24);
      }
      if (!matchesSpecial) return false;

      // Filter by Field
      if (selectedFields.length > 0) {
        const fieldLabel = getFieldLabel(journal);
        if (!selectedFields.includes(fieldLabel)) return false;
      }

      // Filter by ABS Rank
      if (selectedAbsRanks.length > 0) {
        const matchesAbs =
          journal.abs_rank !== null && selectedAbsRanks.includes(journal.abs_rank);
        if (!matchesAbs) return false;
      }

      return true;
    });
  }, [journals, selectedFields, selectedAbsRanks, isFt50, isUtd24]);

  // Generate Query
  useEffect(() => {
    if (filteredJournals.length === 0) {
      setGeneratedQuery("");
      return;
    }

    const issns = filteredJournals
      .map((j) => j.issn)
      .filter((issn) => issn && issn.length > 4 && issn !== "nan")
      .map((issn) => issn.trim());

    const uniqueIssns = Array.from(new Set(issns));

    if (uniqueIssns.length === 0) {
      setGeneratedQuery("");
      return;
    }

    const issnQuery = `IS=(${uniqueIssns.join(" OR ")})`;

    let finalQuery = issnQuery;
    if (keywords.trim()) {
      const kw = keywords.trim();
      finalQuery = `(${issnQuery}) AND TS=(${kw})`;
    }

    setGeneratedQuery(finalQuery);
  }, [filteredJournals, keywords]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedQuery);
    alert(t.copied);
  };

  const toggleSelection = (
    list: string[],
    item: string,
    setter: (val: string[]) => void
  ) => {
    if (list.includes(item)) {
      setter(list.filter((i) => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  const keywordValidation = useMemo(
    () => validateKeywords(keywords),
    [keywords, language]
  );

  useEffect(() => {
    setSelectedFields([]);
    setCurrentPage(1);
  }, [language]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFields, selectedAbsRanks, isFt50, isUtd24, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredJournals.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedJournals = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredJournals.slice(start, start + pageSize);
  }, [filteredJournals, safeCurrentPage, pageSize]);

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
      <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden">
        {/* Header */}
        <header className="bg-gradient-to-r from-blue-700 to-indigo-800 p-8 text-white">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{t.appTitle}</h1>
              <p className="opacity-80 mt-2">{t.appSubtitle}</p>
            </div>
            <div className="flex items-center gap-2 self-start">
              <span className="text-xs uppercase tracking-wider opacity-80">
                {t.languageLabel}
              </span>
              <div className="inline-flex rounded-lg border border-white/30 overflow-hidden">
                <button
                  onClick={() => setLanguage("en")}
                  className={`px-3 py-1.5 text-xs font-semibold transition ${
                    language === "en"
                      ? "bg-white text-blue-700"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage("zh")}
                  className={`px-3 py-1.5 text-xs font-semibold transition ${
                    language === "zh"
                      ? "bg-white text-blue-700"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  中文
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Panel: Filters */}
          <div className="lg:col-span-4 space-y-8 border-r border-gray-100 pr-4">
            {/* Special Collections */}
            <section>
              <h3 className="font-semibold text-gray-700 mb-3 uppercase tracking-wider text-sm">
                {t.specialCollections}
              </h3>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center space-x-2 cursor-pointer select-none border px-3 py-2 rounded-lg hover:bg-gray-50 transition">
                  <input
                    type="checkbox"
                    checked={isFt50}
                    onChange={(e) => setIsFt50(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="font-medium">FT50</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer select-none border px-3 py-2 rounded-lg hover:bg-gray-50 transition">
                  <input
                    type="checkbox"
                    checked={isUtd24}
                    onChange={(e) => setIsUtd24(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="font-medium">UTD24</span>
                </label>
              </div>
            </section>

            {/* ABS Rankings */}
            <section>
              <h3 className="font-semibold text-gray-700 mb-3 uppercase tracking-wider text-sm">
                {t.absRanking}
              </h3>
              <div className="flex flex-wrap gap-2">
                {uniqueAbsRanks.map((rank) => (
                  <button
                    key={rank}
                    onClick={() =>
                      toggleSelection(selectedAbsRanks, rank, setSelectedAbsRanks)
                    }
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                      selectedAbsRanks.includes(rank)
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {rank}
                  </button>
                ))}
              </div>
            </section>

            {/* Fields */}
            <section>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-700 uppercase tracking-wider text-sm">
                  {t.researchFields}
                </h3>
                <button
                  onClick={() =>
                    setSelectedFields(
                      selectedFields.length === uniqueFields.length
                        ? []
                        : [...uniqueFields]
                    )
                  }
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {selectedFields.length === uniqueFields.length
                    ? t.deselectAll
                    : t.selectAll}
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1 p-2 border rounded-lg bg-gray-50 text-sm scrollbar-thin scrollbar-thumb-gray-300">
                {uniqueFields.map((field) => (
                  <label
                    key={field}
                    className="flex items-center space-x-2 p-1.5 hover:bg-white rounded cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field)}
                      onChange={() =>
                        toggleSelection(selectedFields, field, setSelectedFields)
                      }
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="truncate" title={field}>
                      {field}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          </div>

          {/* Right Panel: Output & Preview */}
          <div className="lg:col-span-8 flex flex-col h-full">
            {/* Query Section */}
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">
                {t.queryBuilder}
              </h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.keywordsLabel}
                </label>
                <div className="text-xs text-gray-500 mb-2">
                  <span className="font-medium text-gray-600">
                    {t.keywordsExampleLabel}
                  </span>{" "}
                  {t.keywordsExample}
                </div>
                <textarea
                  className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder={t.keywordsExample}
                  rows={2}
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">{t.keywordsHelper}</p>
                {!keywordValidation.isValid && (
                  <p className="text-xs text-orange-600 mt-1">
                    {keywordValidation.warning}
                  </p>
                )}
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.generatedQuery}
                </label>
                <div className="w-full p-4 bg-white border border-gray-300 rounded-lg font-mono text-sm text-gray-600 break-all h-32 overflow-y-auto">
                  {generatedQuery || (
                    <span className="text-gray-400 italic">
                      {t.selectFiltersHint}
                    </span>
                  )}
                </div>
                {generatedQuery && (
                  <button
                    onClick={copyToClipboard}
                    className="absolute top-9 right-4 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 shadow-md transition"
                  >
                    {t.copyQuery}
                  </button>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <span>
                  {t.matchedJournals}:{" "}
                  <strong className="text-gray-900">
                    {filteredJournals.length}
                  </strong>
                </span>
              </div>
            </div>

            {/* Journal List Preview */}
            <div className="flex-1 flex flex-col min-h-0">
              <h3 className="font-semibold text-gray-700 mb-3">
                {t.previewTitle}
              </h3>
              <div className="flex-1 overflow-auto border border-gray-200 rounded-lg shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 text-gray-600 font-medium sticky top-0">
                    <tr>
                      <th className="px-4 py-3">{t.columnJournal}</th>
                      <th className="px-4 py-3 w-32">{t.columnRank}</th>
                      <th className="px-4 py-3 w-48">{t.columnField}</th>
                      <th className="px-4 py-3 w-32">{t.columnIssn}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredJournals.length > 0 ? (
                      paginatedJournals.map((journal, idx) => (
                        <tr key={idx} className="hover:bg-blue-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {journal.title}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {journal.abs_rank && (
                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                                  ABS {journal.abs_rank}
                                </span>
                              )}
                              {journal.is_ft50 && (
                                <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded">
                                  FT50
                                </span>
                              )}
                              {journal.is_utd24 && (
                                <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded">
                                  UTD24
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {getFieldLabel(journal)}
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-500 text-xs">
                            {journal.issn}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500">
                          {t.noJournals}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span>{t.rowsPerPage}</span>
                  <select
                    className="border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    {[10, 20, 30, 40, 50].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span>
                    {t.page} {safeCurrentPage} {t.of} {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={safeCurrentPage === 1}
                      className="px-3 py-1.5 rounded-md border text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                    >
                      {t.previous}
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      disabled={safeCurrentPage === totalPages}
                      className="px-3 py-1.5 rounded-md border text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                    >
                      {t.next}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
        <footer className="text-center text-xs text-gray-500 py-4">Harry Lee</footer>
      </div>
    </div>
  );
}
