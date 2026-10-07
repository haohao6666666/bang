# 日历上下滚动修复

三天演示的日历纸卡较长；滚动到纸卡下半部后，鼠标滚轮或触控板的向上手势停留在横向 Carousel 上，无法传递到整页。普通模式有较多记录时也会出现。

根因：Carousel 原本同时在横向、纵向设置 overscroll-behavior: contain，阻止垂直滚动传递；该容器实际只负责左右切换日期。

修复：在应用页面的横向 Carousel 上保留横向 contain，纵向改为 auto，将垂直滚动传给页面。保持原有触摸方向判断、拖动后的点击抑制、日期点击与详情逻辑。没有改变记录、FocusLog、数据 migration、纸卡排版或展示数量。

回归覆盖：普通与三天演示模式，在 360、393、1366 像素宽度的纸卡底部向上滚动，连续回到页顶；确认日期位置、任务与时间记录不变。另验证真实触摸的上下滚动、左右日期切换、原日历点击，以及 WebKit 浏览器。

验证结果：check:runtime（24 个保护文件）、tsc --noEmit、build、test:sites（4 项）、test:production（1 项）均通过；test:runtime 95 项通过。WebKit 的日历、滚动与运行时检查 16 项通过，1 项 Chromium 专用触摸测试跳过（已在 Chromium 通过）。

本地修改前文件：.local/calendar-scroll/before-fix。服务器发布前保留当时源码及镜像，路径为 /opt/zhitu/backups/before-calendar-scroll-20261004/source.tar.gz，镜像为 tencent-zhitu:before-calendar-scroll-20261004。个人记录及服务器私有数据不在更新包中。
