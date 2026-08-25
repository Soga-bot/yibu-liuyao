"""
龟壳摇铜钱 - 解卦详情页
提供卦辞原文、白话译文、AI建议三个维度的解读
"""

import streamlit as st
import random
from datetime import datetime

# 卦辞数据库（简化版）
HEXAGRAM_TEXTS = {
    '乾': {
        'original': '乾，元亨利贞。',
        'explanation': '乾卦象征天，具有元始、亨通、和谐、贞正四德。',
        'interpretation': '天行健，君子以自强不息。此时正是大展宏图的好时机。'
    },
    '坤': {
        'original': '坤，元亨，利牝马之贞。',
        'explanation': '坤卦象征地，厚德载物，宜于顺从而守正。',
        'interpretation': '地势坤，君子以厚德载物。以柔克刚，顺势而为。'
    },
    '屯': {
        'original': '屯，元亨利贞，勿用有攸往，利建侯。',
        'explanation': '屯卦象征初生之难，宜守不宜进。',
        'interpretation': '万物初生，困难重重，需要耐心等待时机。'
    },
    '蒙': {
        'original': '蒙，亨。匪我求童蒙，童蒙求我。',
        'explanation': '蒙卦象征启蒙教化，教学相长。',
        'interpretation': '启蒙之时，师者循循善诱，学者虚心求教。'
    }
    # 可以继续添加更多卦辞...
}

# 幸运色彩配色方案
LUCKY_COLORS = {
    '红色系': {'hex': '#D32F2F', 'name': '朱砂红'},
    '橙色系': {'hex': '#FF6F00', 'name': '橘皮橙'},
    '黄色系': {'hex': '#F57C00', 'name': '琥珀黄'},
    '绿色系': {'hex': '#388E3C', 'name': '翡翠绿'},
    '蓝色系': {'hex': '#1976D2', 'name': '青花蓝'},
    '紫色系': {'hex': '#7B1FA2', 'name': '紫晶紫'},
    '棕色系': {'hex': '#8C6B4F', 'name': '龟背褐'},
    '金色系': {'hex': '#C5A46C', 'name': '铜绿金'}
}

def reading_page():
    """解卦详情页面"""
    if 'current_hexagram' not in st.session_state:
        st.error("没有卦象数据，请重新占卜")
        if st.button("🔄 返回首页"):
            st.session_state.current_page = 'shell'
            st.rerun()
        return
    
    hexagram_data = st.session_state.current_hexagram
    
    # 页面标题
    st.markdown('<h1 class="app-title">📖 解卦详情</h1>', unsafe_allow_html=True)
    
    # 卦象概览
    show_hexagram_overview(hexagram_data)
    
    # Tab选择器
    tab1, tab2, tab3 = st.tabs(["📜 卦辞原文", "🎯 白话译文", "🌟 AI建议"])
    
    with tab1:
        show_original_text(hexagram_data)
    
    with tab2:
        show_interpretation(hexagram_data)
    
    with tab3:
        show_ai_advice(hexagram_data)
    
    # 保存到历史记录
    save_to_history(hexagram_data)
    
    # 底部导航
    show_bottom_navigation()

def show_hexagram_overview(hexagram_data):
    """显示卦象概览"""
    st.markdown(f"""
    <div class="card" style="text-align: center;">
        <h2 style="color: #3A5440; margin: 20px 0;">
            {hexagram_data['original_name']}
        </h2>
        <p style="color: #8C6B4F; font-size: 1.1em;">
            {hexagram_data['original_description']}
        </p>
        <p style="color: #666; font-size: 0.9em;">
            {hexagram_data['original_palace']} · 
            {datetime.fromisoformat(hexagram_data['timestamp']).strftime('%Y年%m月%d日 %H:%M')}
        </p>
    </div>
    """, unsafe_allow_html=True)
    
    # 显示问题
    if hexagram_data.get('question'):
        st.markdown(f"""
        <div class="card">
            <h4 style="color: #C5A46C;">🎯 占问事项</h4>
            <p style="background: #f8f9fa; padding: 15px; border-radius: 10px; 
               border-left: 4px solid #C5A46C;">
                {hexagram_data['question']}
            </p>
        </div>
        """, unsafe_allow_html=True)

def show_original_text(hexagram_data):
    """显示卦辞原文"""
    hexagram_name = hexagram_data['original_name']
    hexagram_text = HEXAGRAM_TEXTS.get(hexagram_name, {
        'original': '卦辞待查',
        'explanation': '此卦象征变化之道，需结合具体情况分析。',
        'interpretation': '请参考传统易学典籍获取更详细的解读。'
    })
    
    st.markdown(f"""
    <div class="card">
        <h3 style="color: #3A5440;">📜 {hexagram_name}卦 · 卦辞</h3>
        
        <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    padding: 30px; border-radius: 15px; margin: 20px 0;
                    border: 2px solid #C5A46C;">
            <p style="font-family: '楷体', 'KaiTi', serif; font-size: 1.5em;
               text-align: center; color: #3A5440; line-height: 2;
               margin: 0;">
                {hexagram_text['original']}
            </p>
        </div>
        
        <h4 style="color: #8C6B4F; margin-top: 30px;">📚 古文注释</h4>
        <p style="line-height: 1.8; color: #333; background: #fff;
           padding: 20px; border-radius: 10px; border-left: 4px solid #8C6B4F;">
            {hexagram_text['explanation']}
        </p>
    </div>
    """, unsafe_allow_html=True)
    
    # 显示变爻信息
    show_changing_lines_detail(hexagram_data)

def show_interpretation(hexagram_data):
    """显示白话译文"""
    hexagram_name = hexagram_data['original_name']
    hexagram_text = HEXAGRAM_TEXTS.get(hexagram_name, {
        'interpretation': '此卦蕴含变化之机，需要结合当下情况，以诚心感应天地之理。'
    })
    
    st.markdown(f"""
    <div class="card">
        <h3 style="color: #3A5440;">🎯 白话译文</h3>
        
        <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
                    padding: 25px; border-radius: 15px; margin: 20px 0;">
            <p style="font-size: 1.2em; line-height: 2; color: #1565c0;">
                {hexagram_text['interpretation']}
            </p>
        </div>
        
        <h4 style="color: #8C6B4F;">🔍 卦象分析</h4>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
            {generate_hexagram_analysis(hexagram_data)}
        </div>
    </div>
    """, unsafe_allow_html=True)

def show_ai_advice(hexagram_data):
    """显示AI建议"""
    # 生成AI建议内容
    ai_advice = generate_ai_advice(hexagram_data)
    
    st.markdown(f"""
    <div class="card">
        <h3 style="color: #3A5440;">🌟 今日建议</h3>
        <p style="color: #666; font-size: 0.9em; margin-bottom: 20px;">
            以下建议由AI结合卦象生成，仅供参考
        </p>
        
        <div style="display: grid; gap: 15px;">
            {ai_advice}
        </div>
    </div>
    """, unsafe_allow_html=True)

def show_changing_lines_detail(hexagram_data):
    """显示变爻详细信息"""
    lines = hexagram_data.get('lines', [])
    changing_lines = [(i+1, line) for i, line in enumerate(lines) if line.get('changeable', False)]
    
    if changing_lines:
        st.markdown(f"""
        <div class="card">
            <h4 style="color: #C5A46C;">🔴 变爻解析</h4>
            <div style="background: #fff3cd; padding: 15px; border-radius: 10px;">
        """, unsafe_allow_html=True)
        
        for line_num, line_data in changing_lines:
            yao_name = get_line_name(line_num)
            st.markdown(f"""
                <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 8px;">
                    <strong>{yao_name}</strong>：{line_data['name']} 变
                    <br>
                    <small style="color: #856404;">
                        此爻有变化之象，需特别留意相关事项的发展
                    </small>
                </div>
            """, unsafe_allow_html=True)
        
        st.markdown("</div></div>", unsafe_allow_html=True)

def generate_hexagram_analysis(hexagram_data):
    """生成卦象分析"""
    lines = hexagram_data.get('lines', [])
    yang_count = sum(1 for line in lines if line['name'] in ['少阳', '老阳'])
    yin_count = 6 - yang_count
    
    analysis_parts = []
    
    # 阴阳分析
    if yang_count > yin_count:
        analysis_parts.append("阳气较盛，宜主动进取")
    elif yin_count > yang_count:
        analysis_parts.append("阴气较重，宜静守待时")
    else:
        analysis_parts.append("阴阳平衡，刚柔相济")
    
    # 变爻分析
    changing_count = sum(1 for line in lines if line.get('changeable', False))
    if changing_count == 0:
        analysis_parts.append("无变爻，局势稳定")
    elif changing_count == 1:
        analysis_parts.append("一爻独变，变化明确")
    else:
        analysis_parts.append(f"{changing_count}爻俱变，变化复杂")
    
    return "<br>• ".join(["• " + part for part in analysis_parts])

def generate_ai_advice(hexagram_data):
    """生成AI建议内容"""
    hexagram_name = hexagram_data['original_name']
    
    # 根据卦名生成针对性建议
    advice_templates = {
        '乾': {
            'career': '🔥 事业运佳，适合开展新项目或寻求突破',
            'love': '💑 感情方面主动出击，真诚表达获得好结果', 
            'health': '💪 精力充沛，适合加强锻炼强身健体',
            'wealth': '💰 财运亨通，投资理财可获得不错收益'
        },
        '坤': {
            'career': '🌱 事业需要厚积薄发，踏实工作终有收获',
            'love': '💝 感情宜温柔包容，以德感化对方',
            'health': '🧘‍♀️ 注意调养身心，多休息避免过度劳累', 
            'wealth': '🏦 理财宜保守稳健，积少成多细水长流'
        }
    }
    
    # 获取建议模板，如果没有则使用通用模板
    advice_set = advice_templates.get(hexagram_name, {
        'career': '⚡ 事业发展需要把握时机，顺势而为',
        'love': '💕 感情生活需要真诚相待，用心经营',
        'health': '🍃 身体健康需要劳逸结合，保持平衡',
        'wealth': '💎 财富积累需要理性规划，稳中求进'
    })
    
    # 随机选择幸运色
    lucky_color_key = random.choice(list(LUCKY_COLORS.keys()))
    lucky_color = LUCKY_COLORS[lucky_color_key]
    
    advice_html = f"""
    <div style="background: #e8f5e8; padding: 20px; border-radius: 12px; margin: 10px 0;">
        <h4 style="color: #2e7d32; margin-top: 0;">💼 事业财运</h4>
        <p>{advice_set['career']}</p>
    </div>
    
    <div style="background: #fce4ec; padding: 20px; border-radius: 12px; margin: 10px 0;">
        <h4 style="color: #c2185b; margin-top: 0;">💖 感情婚姻</h4>
        <p>{advice_set['love']}</p>
    </div>
    
    <div style="background: #e3f2fd; padding: 20px; border-radius: 12px; margin: 10px 0;">
        <h4 style="color: #1976d2; margin-top: 0;">🏥 健康平安</h4>
        <p>{advice_set['health']}</p>
    </div>
    
    <div style="background: #fff3e0; padding: 20px; border-radius: 12px; margin: 10px 0;">
        <h4 style="color: #f57c00; margin-top: 0;">🎨 今日幸运</h4>
        <p>🎨 <strong>幸运色彩：</strong>
           <span style="display: inline-block; width: 20px; height: 20px; 
                        background: {lucky_color['hex']}; border-radius: 50%; 
                        vertical-align: middle; margin: 0 8px;"></span>
           {lucky_color['name']}
        </p>
        <p>🔢 <strong>幸运数字：</strong>{random.randint(1, 9)}</p>
        <p>🧭 <strong>吉利方位：</strong>{random.choice(['东', '南', '西', '北', '东南', '西南', '东北', '西北'])}方</p>
    </div>
    """
    
    return advice_html

def get_line_name(line_num):
    """获取爻位名称"""
    line_names = {
        1: "初爻",
        2: "二爻", 
        3: "三爻",
        4: "四爻",
        5: "五爻",
        6: "上爻"
    }
    return line_names.get(line_num, f"第{line_num}爻")

def save_to_history(hexagram_data):
    """保存占卜记录到历史"""
    if 'history_saved' not in st.session_state:
        # 生成AI解读摘要
        ai_summary = f"{hexagram_data['original_description']} 建议把握时机，顺势而为。"
        
        history_record = {
            'timestamp': hexagram_data['timestamp'],
            'question': hexagram_data.get('question', ''),
            'hexagram_name': hexagram_data['original_name'],
            'hexagram_description': hexagram_data['original_description'],
            'lines': [line['name'] for line in hexagram_data['lines']],
            'ai_reading': ai_summary
        }
        
        if 'history' not in st.session_state:
            st.session_state.history = []
        
        st.session_state.history.append(history_record)
        st.session_state.history_saved = True

def show_bottom_navigation():
    """显示底部导航"""
    st.markdown("---")
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        if st.button("🏠 返回首页"):
            reset_reading_state()
            st.session_state.current_page = 'shell'
            st.rerun()
    
    with col2:
        if st.button("📜 历史记录"):
            st.session_state.current_page = 'history'
            st.rerun()
    
    with col3:
        if st.button("🔄 再摇一卦"):
            reset_reading_state()
            st.session_state.current_page = 'shell'
            st.rerun()
    
    with col4:
        if st.button("📤 分享卦象"):
            st.info("🎊 可截屏保存分享您的卦象解读")

def reset_reading_state():
    """重置解读相关状态"""
    keys_to_remove = ['current_hexagram', 'history_saved', 'shake_count', 'lines', 'current_question']
    for key in keys_to_remove:
        if key in st.session_state:
            del st.session_state[key]