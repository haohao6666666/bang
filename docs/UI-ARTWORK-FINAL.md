# 知途 · 最终绘图素材与提示词

工具：内置 image_gen。铁环和海报背景由绘图工具生成；可扫码的二维码及中文排版分别制作后合成。

最终海报：
- PNG：C:/Users/dazuijing/Documents/Codex/2026-10-03/https-github-com-haohao6666666-bang-https/outputs/展示物料/知途_评委扫码体验_平板横版.png
- JPG：C:/Users/dazuijing/Documents/Codex/2026-10-03/https-github-com-haohao6666666-bang-https/outputs/展示物料/知途_评委扫码体验_平板横版.jpg
- 公开图片：https://zhitu.124-156-163-245.sslip.io/assets/judge-invitation/zhitu-qr-poster.jpg

字标与三个导航插画的原稿、提示词见 [UI-ARTWORK-PROMPTS.md](UI-ARTWORK-PROMPTS.md)。以下保留本次最终使用的铁环、海报背景提示词。

## binder-ring-v3（当前使用）

网页文件：C:/Users/dazuijing/Documents/Codex/2026-10-03/https-github-com-haohao6666666-bang-https/outputs/jixiang-prototype/public/assets/ui-polish/binder-ring-v3.webp

原稿：artwork/ui-polish/binder-ring-v3.png。使用内置 image_gen 生成；旧 v2 不再使用。显示尺寸 40 × 26 CSS 像素，跨在纸页左边缘内外。按实际纸页高度每隔 112 像素自动补齐，随作品加载与宽度变化重新计算。

最终提示词：

Use case: stylized-concept. Asset type: ONE independent binder-ring sprite for the left edge of a warm ivory-paper journal app. Match the small horizontal notebook binding loops in the user's supplied reference: a short, softly rounded, slightly foreshortened oval loop of warm grey champagne-taupe metal, a thin smooth curved arch, softly shaded cream highlight and warm pencil outline. Width about 1.7 times height, medium-thin wire. The convex left arc wraps around the paper edge and the two short right tips enter two small subtle taupe paper holes. It should look like an actual little loose-leaf notebook loop crossing an edge: half the arch outside the paper and half just inside. Draw the complete single loop ONLY; no actual paper, no page, no vertical spine, no row of rings. Hand-painted stationery illustration matching cozy Chinese watercolor journal UI, not a photorealistic bracelet. Genuine fully transparent background including the center of the loop; isolated centered clear silhouette and a small transparent margin, suitable for 40 by 26 CSS pixels. No text, no numbers, no glossy chrome, no yellow gold, no chunky C bracelet, no huge thick tube, no exaggerated drop shadow.

## 评委扫码海报背景

原稿：artwork/marketing/judge-scan-background.png。使用内置 image_gen 生成独立背景；文字与可解码二维码在 HTML 中排版后导出，不让绘图模型修改二维码。

最终提示词：

Use case: ads-marketing. Asset type: high-resolution landscape 4:3 background illustration for a Chinese education app called Zhitu, to be displayed on a tablet at a judging booth. Warm premium watercolor children's storybook painting on light ivory textured paper, sage green plants, muted peach and dusty blue details, calm sunny warmth. In the lower LEFT quadrant, the app's cream-colored little puppy with brown floppy ears and a tiny two-leaf green sprout on its head sits at a study desk, gently looking toward the viewer beside an open personal journal with a simple puppy sketch, a pencil and a small potted sprout. Detailed but restrained hand-painted watercolor, friendly companion, not glossy plastic and not photorealistic. Composition: keep the upper LEFT 50% of the image very light, plain and spacious for brand and headline typography added separately. Keep the entire RIGHT 45% a uniform uncluttered light ivory wall/paper negative space for a large QR code panel added separately, with no objects or illustrations there. Only a few tiny botanical leaves in outer corners, no objects near the center-right QR area. The puppy and open notebook form a charming visual anchor in the lower left, filling about one third of image; bottom edge fades naturally into warm paper. This is a background artwork, no words, letters, text, QR codes, logos, badges, buttons, phone mockup or interface cards anywhere. Landscape 4:3 composition.
