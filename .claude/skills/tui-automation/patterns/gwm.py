#!/usr/bin/env python3
"""
gwm-rust TUI画面のセマンティック抽出

gwm-rustのAppStateに対応したパターン認識を行い、
画面状態をJSON形式で出力する。

AppState種類:
- Loading: ローディング中（スピナー表示）
- Success: 成功表示
- Error: エラー表示
- TextInput: テキスト入力（新規ブランチ作成）
- SelectList: 選択リスト（リモートブランチ選択）
- Confirm: 確認ダイアログ（フック実行確認）
"""

import re
import json
import sys


def parse_gwm_screen(raw: str) -> dict:
    """gwm-rustの画面出力を構造化データに変換"""
    lines = [l.rstrip() for l in raw.split('\n')]
    non_empty = [l for l in lines if l.strip()]

    # パターン1: SelectList（addコマンドのリモートブランチ選択等）
    # 「▶ 」マーカーで選択中の項目を検出
    select_items = []
    selected_idx = 0
    in_list = False

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('▶ '):
            in_list = True
            selected_idx = len(select_items)
            item = stripped[2:].strip()
            if item:
                select_items.append(item)
        elif in_list and stripped.startswith('  ') and not stripped.startswith('  ↑') and not stripped.startswith('  ↓'):
            # インデントされた非選択項目（ヘルプテキストは除外）
            item = stripped.strip()
            # ヘルプテキストやナビゲーション説明は除外
            if item and not any(x in item for x in ['navigate', 'select', 'search', '•', 'Ctrl']):
                select_items.append(item)

    if select_items:
        # 統計情報を抽出（N / M items）
        stats_match = re.search(r'(\d+)\s*/\s*(\d+)\s*items', raw)
        return {
            'type': 'select_list',
            'title': extract_title(lines),
            'items': select_items[:10],  # 最大10件でトークン節約
            'selected': selected_idx,
            'total': int(stats_match.group(2)) if stats_match else len(select_items),
            'filtered': int(stats_match.group(1)) if stats_match else len(select_items)
        }

    # パターン2: TextInput（Create new worktree）
    # 「❯ 」プロンプト + カーソル「█」を検出
    # 注意: 最初の❯行はシェルプロンプト（コマンド実行行）の可能性があるため、
    # 最後の❯行を入力プロンプトとして検出する
    prompt_lines = [l for l in lines if '❯' in l]
    # gwmコマンドを含む行は除外（シェルプロンプト行）
    input_prompt_lines = [l for l in prompt_lines if 'gwm' not in l.lower()]

    if input_prompt_lines:
        # 最後の❯行を入力プロンプトとして使用
        last_prompt = input_prompt_lines[-1]
        # ❯以降のテキストを抽出
        input_match = re.search(r'❯\s*(.*)$', last_prompt)
        input_value = ''
        if input_match:
            # カーソル記号を除去
            input_value = input_match.group(1).replace('█', '').strip()

        title = extract_title(lines)

        # バリデーションエラーを検出
        error = None
        for line in lines:
            if '✗' in line or 'Invalid' in line.lower() or 'invalid' in line:
                error = line.strip()
                break

        # プレビューを検出
        # 形式1: Preview: /path/to/worktree
        # 形式2: ┌Preview───┐ ボックス内にパス
        preview = None
        # ボックス形式のプレビューを検出
        in_preview_box = False
        for line in lines:
            if 'Preview' in line and ('┌' in line or '─' in line):
                in_preview_box = True
                continue
            if in_preview_box:
                if '└' in line or '┘' in line:
                    in_preview_box = False
                    continue
                # パス行を抽出（│で囲まれた行）
                path_match = re.search(r'[│|]\s*(/[^\s│|]+)', line)
                if path_match:
                    preview = path_match.group(1).strip()
                    break
                # ボックス内のパス（先頭にスラッシュがある行）
                clean_line = line.replace('│', '').strip()
                if clean_line.startswith('/'):
                    preview = clean_line
                    break
        # 単純な形式も試行
        if not preview:
            simple_match = re.search(r'Preview[:\s]+(/[^\s]+)', raw)
            if simple_match:
                preview = simple_match.group(1).strip()

        return {
            'type': 'text_input',
            'title': title,
            'value': input_value,
            'error': error,
            'preview': preview
        }

    # パターン3: Confirm（Run post-create hooks?）
    # Trust/Once/Cancel の選択肢を検出
    if 'Trust' in raw and 'Once' in raw and 'Cancel' in raw:
        selected = 'once'  # デフォルト

        # 選択状態を検出（[]やハイライトで判定）
        for line in lines:
            if '[Trust]' in line or ('Trust' in line and '▶' in line):
                selected = 'trust'
                break
            elif '[Cancel]' in line or ('Cancel' in line and '▶' in line):
                selected = 'cancel'
                break
            elif '[Once]' in line or ('Once' in line and '▶' in line):
                selected = 'once'
                break

        # コマンドリストを抽出
        commands = []
        in_commands = False
        for line in lines:
            if 'commands' in line.lower() or '│' in line:
                in_commands = True
                continue
            if in_commands and line.strip():
                # ボーダー文字とオプション文字を除去
                cmd = line.strip()
                cmd = re.sub(r'^[│├└┌┐┘┴┬┤├─═]+\s*', '', cmd)
                cmd = cmd.strip()
                if cmd and not any(x in cmd for x in ['Trust', 'Once', 'Cancel', '─', '═', '│']):
                    commands.append(cmd)

        return {
            'type': 'confirm',
            'title': extract_title(lines),
            'selected': selected,
            'commands': commands[:5]  # 最大5件
        }

    # パターン4: Loading（スピナー）
    spinner_chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    if any(c in raw for c in spinner_chars) or ('...' in raw and len(non_empty) <= 3):
        message = ''
        for line in lines:
            if any(c in line for c in spinner_chars):
                # スピナー文字を除去してメッセージを抽出
                message = re.sub(r'[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s*', '', line).strip()
                break
            elif '...' in line:
                message = line.strip()
                break
        return {
            'type': 'loading',
            'message': message
        }

    # パターン5: Success（✓マーク）
    if '✓' in raw or '✔' in raw:
        messages = []
        for line in lines:
            if '✓' in line or '✔' in line or 'Path:' in line or 'created' in line.lower() or 'success' in line.lower():
                messages.append(line.strip())
        return {
            'type': 'success',
            'messages': messages[:5]
        }

    # パターン6: Error（✗マーク）
    if '✗' in raw or '✖' in raw or 'error:' in raw.lower() or 'Error:' in raw:
        messages = []
        for line in lines:
            if '✗' in line or '✖' in line or 'error' in line.lower():
                messages.append(line.strip())
        return {
            'type': 'error',
            'messages': messages[:5]
        }

    # パターン7: MultiSelectList（removeコマンド）
    # チェックボックス「☐」「☑」または「[ ]」「[x]」を検出
    if '☐' in raw or '☑' in raw or re.search(r'\[[x ]\]', raw):
        items = []
        for line in lines:
            # Unicode チェックボックス
            if '☐' in line:
                item_text = line.replace('☐', '').strip()
                if item_text:
                    items.append({'label': item_text, 'checked': False})
            elif '☑' in line:
                item_text = line.replace('☑', '').strip()
                if item_text:
                    items.append({'label': item_text, 'checked': True})
            # ASCII チェックボックス
            elif '[ ]' in line:
                item_text = re.sub(r'\[ \]\s*', '', line).strip()
                if item_text:
                    items.append({'label': item_text, 'checked': False})
            elif '[x]' in line or '[X]' in line:
                item_text = re.sub(r'\[[xX]\]\s*', '', line).strip()
                if item_text:
                    items.append({'label': item_text, 'checked': True})

        if items:
            return {
                'type': 'multi_select',
                'title': extract_title(lines),
                'items': items[:10],
                'selected_count': sum(1 for i in items if i['checked'])
            }

    # パターン8: Table（listコマンド）
    # ヘッダー行を検出
    if any(x in raw for x in ['STATUS', 'BRANCH', 'PATH']) or '══' in raw or '──' in raw:
        rows = []
        in_data = False
        for line in lines:
            if '══' in line or '──' in line:
                in_data = True
                continue
            if in_data and line.strip():
                # テーブル行をパース
                parts = line.split()
                if len(parts) >= 2:
                    rows.append({
                        'status': parts[0] if parts[0] in ['*', 'M', '-', '✓', '✗'] else '',
                        'branch': parts[1] if len(parts) > 1 else '',
                        'path': parts[-1] if len(parts) > 2 else ''
                    })

        if rows:
            return {
                'type': 'table',
                'title': 'Worktrees',
                'rows': rows[:10],
                'total': len(rows)
            }

    # パターン9: Help/Welcome画面
    if 'gwm' in raw.lower() and ('help' in raw.lower() or 'usage' in raw.lower() or 'commands' in raw.lower()):
        return {
            'type': 'help',
            'content': '\n'.join(non_empty[:10])
        }

    # パターン10: 空または不明
    if not non_empty:
        return {
            'type': 'empty',
            'message': 'Screen is empty'
        }

    # 不明な場合は先頭100文字を返す
    return {
        'type': 'unknown',
        'raw': raw[:200].replace('\n', ' ')
    }


def extract_title(lines: list) -> str:
    """画面からタイトルを抽出"""
    for line in lines[:10]:
        stripped = line.strip()
        # 除外パターン
        # - プロンプト記号やリスト記号で始まる行
        # - gwmコマンドを含む行（シェルプロンプト行）
        # - 統計行（N / M items）
        # - シェルプロンプト記号（░▒▓, $, >, %）を含む行
        if not stripped:
            continue
        if stripped.startswith(('❯', '▶', '  ', '│', '─', '═', '☐', '☑', '[', '*', './')):
            continue
        if 'gwm' in stripped.lower():
            continue
        if re.search(r'\d+\s*/\s*\d+\s*items', stripped):
            continue
        if any(c in stripped for c in ['░', '▒', '▓', '»', '$✘', '%']):
            continue
        # 短すぎる行は除外
        if len(stripped) > 3:
            return stripped
    return ''


if __name__ == '__main__':
    raw = sys.stdin.read()
    result = parse_gwm_screen(raw)
    print(json.dumps(result, ensure_ascii=False, indent=2))
