import { Dot } from './dot';
import { Css } from './utils/css';
import { Svg } from './utils/svg';
import { debounce } from './utils/util';
import { Vector } from './vector';

type PatternLockCallback = {
    verify: (value: string) => boolean,
    complete: (value: string) => void,
    reset?: () => void
};

export class PatternLock {
    /** 图形锁父容器元素 */
    container: HTMLElement;
    /** 回调函数对象 */
    callback: PatternLockCallback;
    /** 图形锁的值 */
    value: string;
    /** 图形锁的宽度（宽度将等于高度）*/
    width: number;
    /** 圆点的半径 */
    radius: number;
    /** 圆点的外边距 */
    margin: number;
    /** 图形锁SVG 元素 */
    svg: SVGElement;
    /** 储存九个圆点实例的数组 */
    dotsPos: Array<Dot> = [];
    /** 折线元素 */
    polyline: SVGPolylineElement;
    /** 折线的上一个坐标 */
    lastPos: Vector;
    /** 折线的当前坐标 */
    currentPos: Vector;
    /** 折线的points属性值 */
    points: string;
    /** 图形锁是否被操作过 */
    isDirty: boolean;
    /** 图形锁的动画样式 */
    style: HTMLStyleElement;

    /**
     * 构造函数
     * @param selectors 选择器
     * @param callback
     */
    constructor(selectors: string, callback: PatternLockCallback) {
        this.container = document.querySelector(selectors);
        this.callback = callback;

        this.svg = Svg.createSvgElement();
        this.svg.style.width = this.svg.style.height = '100%';
        this.container.appendChild(this.svg);

        this.init();

        for (const dot of this.dotsPos) { // 绘制大圆点
            dot.element = this.drawDot(dot.x, dot.y, this.radius, '#eee', 'dot');
            this.addClickEventListener(dot);
        }

        this.addTouchMoveEventListener();
        this.addTouchCompleteEventListener();
    }

    /**
     * 初始化图形锁
     */
    init() {
        // 根据父元素的尺寸计算图形锁的一些尺寸
        this.width = this.container.clientWidth;
        this.radius = this.width / 6 * .7;
        this.margin = (this.width - this.radius * 6) / 4;

        this.style && document.head.removeChild(this.style);
        this.style = Css.addStyle(`
            .inner-dot {
                animation: gl-inner-dot-scale .25s ease-in;
            }
            @keyframes gl-inner-dot-scale {
                0% {
                    r: ${this.radius / 2.5};
                } 50% {
                    r: ${this.radius / 2};
                } 100% {
                    r: ${this.radius / 2.5};
                }
            }
        `);

        const pos = [
            this.radius + this.margin,
            this.radius * 3 + this.margin * 2,
            this.radius * 5 + this.margin * 3
        ];

        this.dotsPos = [
            new Dot(pos[0], pos[0], '1'),
            new Dot(pos[1], pos[0], '2'),
            new Dot(pos[2], pos[0], '3'),
            new Dot(pos[0], pos[1], '4'),
            new Dot(pos[1], pos[1], '5'),
            new Dot(pos[2], pos[1], '6'),
            new Dot(pos[0], pos[2], '7'),
            new Dot(pos[1], pos[2], '8'),
            new Dot(pos[2], pos[2], '9')
        ];
    }

    /**
     * 为圆点元素添加ontouchstart或mousemove事件
     * @param dot
     */
    addClickEventListener(dot: Dot) {
        const listener = () => {
            // 如果图形锁已经被操作过 如果该点没有被选中
            if (this.isDirty || dot.isActive) { return; }

            this.isDirty = true;
            dot.isActive = true;
            dot.element.setAttribute('fill', '#a7ffeb');
            this.drawDot(dot.x, dot.y, this.radius / 2.5, '#1de9b6', 'inner-dot'); // 添加小圆点

            this.lastPos = new Vector(dot.x, dot.y);    // 上一个坐标点
            this.currentPos = new Vector(dot.x, dot.y); // 当前坐标点
            this.points = `${dot.x} ${dot.y} `;         // 当前折线的points属性值
            this.polyline = Svg.createElement('polyline', {
                points: this.points,
                'stroke-linejoin': 'round',
                'stroke-linecap': 'round',
                stroke: '#1de9b6',
                style: `fill:none;stroke-width:${this.radius / 4}`
            }) as SVGPolylineElement;
            this.svg.appendChild(this.polyline);

            this.value = `${dot.value}`;
        }

        if ('ontouchstart' in document.documentElement) {
            dot.element.addEventListener('touchstart', (e: TouchEvent) => {
                e.stopPropagation(); // 阻止冒泡
                // 如果触摸点等于一
                e.touches.length === 1 && listener();
            });
        } else {
            dot.element.addEventListener('mousemove', (e: MouseEvent) => {
                // 如果鼠标移动时按下左键
                e.buttons === 1 && listener();
            });
        }

    }

    /**
     * 为图形锁SVG元素添加ontouchmove事件
     */
    addTouchMoveEventListener() {
        const listener = (x: number, y: number, e: TouchEvent | MouseEvent) => {
            e.preventDefault(); // 防止浏览器下拉
            if (!this.polyline) { return; } // 如果折线不存在

            x = x - this.container.offsetLeft;
            y = y - this.container.offsetTop;

            for (const dot of this.dotsPos) {
                // 如果这个点没有被选中而且当前坐标在圆内
                if (!dot.isActive && dot.getDistance(x, y) <= this.radius * .85) {
                    // 让上一个坐标点等于上一次的当前坐标点
                    this.lastPos.x = this.currentPos.x;
                    this.lastPos.y = this.currentPos.y;

                    this.currentPos = new Vector(dot.x, dot.y); //让上一次的当前坐标点等于选择的坐标点

                    this.points = this.points + `${dot.x} ${dot.y} `;
                    dot.element.setAttribute('fill', '#a7ffeb');
                    dot.isActive = true;
                    this.drawDot(dot.x, dot.y, this.radius / 2.5, '#1de9b6', 'inner-dot'); //添加小圆点

                    for (const d of this.dotsPos) {
                        if (!d.isActive && d.isOnLine(this.lastPos.x, this.lastPos.y, this.currentPos.x, this.currentPos.y)) {
                            d.element.setAttribute('fill', '#a7ffeb');
                            d.isActive = true;
                            this.drawDot(d.x, d.y, this.radius / 2.5, '#1de9b6', 'inner-dot'); //添加小圆点

                            this.value += d.value;
                        }
                    }

                    this.value += dot.value;
                }
                this.polyline.setAttribute('points', this.points + `${x} ${y} `);
            }
        }

        if ('ontouchmove' in document.documentElement) {
            this.svg.addEventListener('touchmove', (e: TouchEvent) => {
                listener(e.changedTouches[0].clientX, e.changedTouches[0].clientY, e);
            })
        } else {
            document.addEventListener('mousemove', (e: MouseEvent) => {
                // 如果鼠标移动时按下左键
                (e.buttons === 1 && this.container.style.pointerEvents !== 'none') && listener(e.clientX, e.clientY, e);
            });
        }
    }

    /**
     * 为图形锁SVG元素添加ontouchend和ontouchcancel事件
     */
    addTouchCompleteEventListener() {
        const complete = () => {
            if (!this.isDirty) { return; }
            this.container.style.pointerEvents = 'none'; // 禁止触摸
            this.polyline && this.polyline.setAttribute('points', this.points); // 截断被手指拉长的那段线
            this.verify();
            this.callback.complete && this.callback.complete(this.value);
            setTimeout(() => {
                this.reset();
                this.container.style.pointerEvents = 'auto';
            }, 1000);
        }

        if ('ontouchend' in document.documentElement) {
            this.svg.addEventListener('touchend', () => complete());

            this.svg.addEventListener('touchcancel', () => complete()); // 当触摸事件被意外中断时
        } else {
            document.addEventListener('mouseup', () => complete()); // 当鼠标松开时
        }
    }

    resize() {
        window.addEventListener('resize', debounce(() => this.init(), 250));
    }

    /**
     * 验证图形密码
     */
    verify() {
        if (!this.callback.verify(this.value)) {
            this.polyline && this.polyline.setAttribute('stroke', '#ff5252');
            for (const dot of this.dotsPos) {
                dot.isActive && dot.element.setAttribute('fill', '#ffcdd2');
            }
            const innerDots: NodeListOf<Element> = document.querySelectorAll('.inner-dot');
            for (let i = 0; i < innerDots.length; i++) {
                innerDots[i].setAttribute('fill', '#ff5252');
            }
            // 震动150毫秒
            'vibrate' in window.navigator && window.navigator.vibrate(150);
        }
    }

    /**
     * 重置图形锁
     */
    reset() {
        this.points = '';
        this.value = '';
        this.isDirty = false;

        if (this.polyline) {
            this.svg.removeChild(this.polyline);
            this.polyline = null;
        }

        const innderDots = this.svg.querySelectorAll('.inner-dot');

        for (const innerDot of innderDots) { // 清除所有小圆点
            this.svg.removeChild(innerDot);
        }

        for (const dot of this.dotsPos) { // 绘制大圆点
            if (dot.isActive) { dot.isActive = false; } // 取消选中
            dot.element.getAttribute('fill') !== '#eee' && dot.element.setAttribute('fill', '#eee'); // 恢复默认颜色
        }

        this.callback.reset && this.callback.reset();
    }

    /**
     * 绘制图形锁的圆点
     * @param cx 圆点X坐标
     * @param cy 圆点Y坐标
     * @param r 圆点半径
     * @param fill 填充颜色
     * @param className 类名
     */
    drawDot(cx: number, cy: number, r: number, fill: string, className: string) {
        const dotElement = Svg.createElement('circle', {
            cx: cx,
            cy: cy,
            r: r,
            fill: fill,
            class: className
        }) as SVGCircleElement;

        this.svg.appendChild(dotElement);

        return dotElement;
    }
}