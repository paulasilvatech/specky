"""MCP server evaluation harness for GitHub Copilot workflows.

This script grades saved task outputs against XML QA fixtures. It is deliberately
provider-neutral: use GitHub Copilot or any MCP client to run the tasks, save the
actual responses as JSON, then run this script to score the results.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


def parse_evaluation_file(file_path: Path) -> list[dict[str, Any]]:
    try:
        root = ET.parse(file_path).getroot()
    except Exception as exc:
        print(f"Error parsing evaluation file {file_path}: {exc}")
        return []
    rows = []
    for index, qa_pair in enumerate(root.findall('.//qa_pair'), start=1):
        question = (qa_pair.findtext('question') or '').strip()
        answer = (qa_pair.findtext('answer') or '').strip()
        if question and answer:
            rows.append({'id': str(index), 'question': question, 'answer': answer})
    return rows


def load_actuals(path: Path) -> dict[str, str]:
    data = json.loads(path.read_text(encoding='utf-8'))
    if isinstance(data, dict):
        return {str(k): str(v) for k, v in data.items()}
    if isinstance(data, list):
        out = {}
        for item in data:
            if isinstance(item, dict):
                key = item.get('id') or item.get('question')
                value = item.get('actual') or item.get('response') or item.get('answer')
                if key is not None and value is not None:
                    out[str(key)] = str(value)
        return out
    raise ValueError('actuals JSON must be an object or a list of objects')


def normalize(value: str) -> str:
    return re.sub(r'\s+', ' ', str(value)).strip()


def evaluate(evals: list[dict[str, Any]], actuals: dict[str, str]) -> list[dict[str, Any]]:
    results = []
    for row in evals:
        actual = actuals.get(row['id'], actuals.get(row['question'], ''))
        expected = row['answer']
        passed = normalize(actual) == normalize(expected)
        results.append({
            'id': row['id'],
            'question': row['question'],
            'expected': expected,
            'actual': actual,
            'score': int(passed),
            'passed': passed,
        })
    return results


def write_report(results: list[dict[str, Any]], output: Path) -> None:
    total = len(results)
    correct = sum(item['score'] for item in results)
    accuracy = (correct / total * 100) if total else 0.0
    lines = [
        '# Evaluation Report',
        '',
        f'- Accuracy: {correct}/{total} ({accuracy:.1f}%)',
        f'- Generated: {time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}',
        '',
    ]
    for item in results:
        status = 'PASS' if item['passed'] else 'FAIL'
        lines.extend([
            f"## Task {item['id']}: {status}",
            '',
            f"Question: {item['question']}",
            f"Expected: `{item['expected']}`",
            f"Actual: `{item['actual']}`",
            '',
        ])
    output.write_text('\n'.join(lines), encoding='utf-8')


def main() -> int:
    parser = argparse.ArgumentParser(description='Grade MCP task outputs against XML QA fixtures')
    parser.add_argument('eval_file', help='XML file containing qa_pair entries')
    parser.add_argument('actuals_json', help='JSON mapping ids or questions to actual answers')
    parser.add_argument('--output', default='evaluation_report.md', help='Markdown report output path')
    args = parser.parse_args()

    evals = parse_evaluation_file(Path(args.eval_file))
    if not evals:
        print('No evaluation rows found')
        return 2
    actuals = load_actuals(Path(args.actuals_json))
    results = evaluate(evals, actuals)
    write_report(results, Path(args.output))
    failed = sum(1 for item in results if not item['passed'])
    print(f'Wrote {args.output}. Passed {len(results) - failed}/{len(results)}.')
    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
