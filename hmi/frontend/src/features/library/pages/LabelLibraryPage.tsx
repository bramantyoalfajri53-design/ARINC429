import { useState } from "react";
import { T1200_LABEL_DICTIONARY, type LabelDefinition } from "../data/labelDictionary";

export function LabelLibraryPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const filtered = T1200_LABEL_DICTIONARY.filter((item: LabelDefinition) => {
    const matchesSearch =
      item.label.includes(search) ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === "ALL" || item.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="label-library-container">
      <div className="section-header">
        <div>
          <h2>AEROFLEX T1200 LABEL DICTIONARY</h2>
          <p className="section-sub">Standard ARINC 429 Octal Label Specifications &amp; Parameters</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="text"
            className="search-input"
            placeholder="Search label, name, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="category-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            <option value="Navigation">Navigation</option>
            <option value="System">System</option>
            <option value="Radio">Radio</option>
            <option value="Engine">Engine</option>
          </select>
        </div>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "90px" }}>LABEL (OCT)</th>
              <th style={{ width: "160px" }}>NAME</th>
              <th>DESCRIPTION</th>
              <th style={{ width: "120px" }}>CATEGORY</th>
              <th style={{ width: "100px" }}>DEFAULT</th>
              <th style={{ width: "80px" }}>UNITS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.label}>
                <td style={{ fontWeight: 700, color: "var(--teal-primary)" }}>{item.label}</td>
                <td style={{ fontWeight: 600 }}>{item.name}</td>
                <td>{item.description}</td>
                <td>
                  <span className="pill-category">{item.category}</span>
                </td>
                <td style={{ fontFamily: "monospace" }}>{item.defaultVal}</td>
                <td>{item.units}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

