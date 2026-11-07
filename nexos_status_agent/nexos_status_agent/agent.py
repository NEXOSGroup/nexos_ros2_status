#!/usr/bin/env python3
"""NEXOS ros_status companion node.

Publishes host vitals (CPU, memory, temperature, load, disk, uptime) as a
diagnostic_msgs/DiagnosticArray on /diagnostics, so the ros_status dashboard
(and any diagnostics consumer) can show them. Pure stdlib + /proc, no pip deps.
"""
import os
import socket

import rclpy
from rclpy.node import Node
from diagnostic_msgs.msg import DiagnosticArray, DiagnosticStatus, KeyValue


def _read_cpu():
    with open("/proc/stat") as f:
        vals = list(map(int, f.readline().split()[1:]))
    idle = vals[3] + (vals[4] if len(vals) > 4 else 0)
    return idle, sum(vals)


class StatusAgent(Node):
    def __init__(self):
        super().__init__("nexos_status_agent")
        self.declare_parameter("rate_hz", 1.0)
        self.declare_parameter("temp_warn", 80.0)
        self.declare_parameter("temp_error", 85.0)
        self.pub = self.create_publisher(DiagnosticArray, "/diagnostics", 10)
        self.host = socket.gethostname()
        self._idle, self._total = _read_cpu()
        rate = float(self.get_parameter("rate_hz").value) or 1.0
        self.create_timer(1.0 / rate, self.tick)
        self.get_logger().info(f"nexos_status_agent up on host '{self.host}'")

    def _cpu_pct(self):
        idle, total = _read_cpu()
        d_total = total - self._total
        pct = 100.0 * (1.0 - (idle - self._idle) / d_total) if d_total > 0 else 0.0
        self._idle, self._total = idle, total
        return max(0.0, min(100.0, pct))

    @staticmethod
    def _mem():
        info = {}
        with open("/proc/meminfo") as f:
            for line in f:
                k, _, rest = line.partition(":")
                info[k] = int(rest.strip().split()[0])
        total = info.get("MemTotal", 1)
        avail = info.get("MemAvailable", 0)
        return 100.0 * (1.0 - avail / total), total // 1024

    @staticmethod
    def _temp():
        try:
            with open("/sys/class/thermal/thermal_zone0/temp") as f:
                return int(f.read().strip()) / 1000.0
        except Exception:
            return None

    def tick(self):
        cpu = self._cpu_pct()
        mem_pct, mem_total_mb = self._mem()
        temp = self._temp()
        la1 = os.getloadavg()[0]
        with open("/proc/uptime") as f:
            uptime = int(float(f.read().split()[0]))
        st = os.statvfs("/")
        disk_pct = 100.0 * (1.0 - st.f_bavail / st.f_blocks) if st.f_blocks else 0.0

        kv = [
            KeyValue(key="CPU %", value=f"{cpu:.1f}"),
            KeyValue(key="Mem %", value=f"{mem_pct:.1f}"),
            KeyValue(key="Mem total MB", value=str(mem_total_mb)),
            KeyValue(key="Load 1m", value=f"{la1:.2f}"),
            KeyValue(key="Disk / %", value=f"{disk_pct:.1f}"),
            KeyValue(key="Uptime s", value=str(uptime)),
        ]
        if temp is not None:
            kv.append(KeyValue(key="Temp C", value=f"{temp:.1f}"))

        warn = float(self.get_parameter("temp_warn").value)
        err = float(self.get_parameter("temp_error").value)
        level = DiagnosticStatus.OK
        if cpu > 90.0 or mem_pct > 90.0 or disk_pct > 90.0 or (temp and temp >= warn):
            level = DiagnosticStatus.WARN
        if temp and temp >= err:
            level = DiagnosticStatus.ERROR

        status = DiagnosticStatus(
            level=level,
            name=f"host: {self.host}",
            message="host vitals",
            hardware_id=self.host,
            values=kv,
        )
        msg = DiagnosticArray()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.status = [status]
        self.pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = StatusAgent()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
