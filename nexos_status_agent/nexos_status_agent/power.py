#!/usr/bin/env python3
"""NEXOS ros_status power-control node.

Exposes a std_srvs/SetBool service to switch the EPOS drive bringup on/off and
publishes its live state, so the ros_status ground station can power the drive
up or down remotely over rosbridge.

  * service  /nexos/epos/power        (std_srvs/srv/SetBool)
        data=true  -> systemctl start <unit>   (drive energised)
        data=false -> systemctl stop  <unit>   (motor de-energised / stromlos)
  * topic    /nexos/epos/power_state  (std_msgs/msg/Bool)   true = unit active

The node runs as the unprivileged bridge user, so switching the (root-owned)
system unit needs a narrow NOPASSWD sudoers rule for exactly
`systemctl start/stop <unit>`. See scripts/install_power_service.sh.
Reading the state (`systemctl is-active`) needs no privilege.
"""
import subprocess

import rclpy
from rclpy.node import Node
from std_srvs.srv import SetBool
from std_msgs.msg import Bool


class PowerControl(Node):
    def __init__(self):
        super().__init__("nexos_power_control")
        self.declare_parameter("unit", "epos-bringup.service")
        self.declare_parameter("poll_hz", 0.5)
        self.unit = str(self.get_parameter("unit").value)
        self.pub = self.create_publisher(Bool, "/nexos/epos/power_state", 10)
        self.srv = self.create_service(SetBool, "/nexos/epos/power", self.on_power)
        hz = float(self.get_parameter("poll_hz").value) or 0.5
        self.create_timer(1.0 / hz, self.tick)
        self.get_logger().info(
            f"nexos_power_control up, unit '{self.unit}' "
            f"(service /nexos/epos/power, state /nexos/epos/power_state)"
        )

    def _is_active(self):
        r = subprocess.run(
            ["systemctl", "is-active", self.unit],
            capture_output=True, text=True, timeout=10,
        )
        return r.stdout.strip() == "active"

    def on_power(self, req, resp):
        action = "start" if req.data else "stop"
        try:
            r = subprocess.run(
                ["sudo", "-n", "/usr/bin/systemctl", action, self.unit],
                capture_output=True, text=True, timeout=40,
            )
            resp.success = r.returncode == 0
            resp.message = (
                f"{self.unit} {action}: "
                + ("ok" if resp.success else (r.stderr.strip() or f"rc={r.returncode}"))
            )
            (self.get_logger().info if resp.success else self.get_logger().error)(resp.message)
        except Exception as e:  # noqa: BLE001
            resp.success = False
            resp.message = f"{action} failed: {e}"
            self.get_logger().error(resp.message)
        self.tick()  # push fresh state immediately
        return resp

    def tick(self):
        msg = Bool()
        try:
            msg.data = self._is_active()
        except Exception:  # noqa: BLE001
            msg.data = False
        self.pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = PowerControl()
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
